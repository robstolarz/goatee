function getAllMatches(regex,str,c){ //inline
	var res, matches = [];
	while((res = regex.exec(str)) !== null)
		matches.push(c(res));
		
	return matches;
}
function quoteForRegex(str) { //thanks StackOverflow
    return (str+'').replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
};

function getMustachesFromTemplate(template){
	var rMustaches = getAllMatches(
		/({{(\S+)}})/g, 
		template, 
		function(res){
			return {
				string:res[2],
				mLength:res[1].length,
				index:res.index
			}
		}
	);
	var mustaches = [];
	for(var i=-1;i<rMustaches.length;++i){ //index; extended for a reason
		/**
		{{mustache 1}} text {{mustache 2}} 
		select two mustaches, pick text between them
		to get text before and after first and last mustaches, 
		pretend you have mustaches ending/ beginning @ 0/ template.length
		*/
		var sBegin;
		if(i != -1){ //if the beginning mustache exists
			var m = rMustaches[i];
			mustaches.push(m); //copy to the new list
			sBegin = m.index + m.mLength; //start the text string from the end of the first mustache
		} else sBegin = 0; //if it doesn't exist, start the text at the beginning
		
		var sEnd;
		if(i != rMustaches.length - 1) //if the end mustache exists
			sEnd = rMustaches[i+1].index; //find the end of the text (the beginning of the next 
		else sEnd = template.length; //if it doesn't, copy to the end of the template
		mustaches.push({ //add a new statement containing
			data: template.substring(sBegin, sEnd)//the text string calculated 
		});
	}
	return mustaches; //and send it on home
}
/*function buildVerifiers(mustaches){
	
}*/
function buildScopes(mustaches){
	var scope = [];
	for(var i=0;i<mustaches.length;++i){
		var m/*ustache*/ = mustaches[i];
		var isIterative = /^\s*\[\s*/.test(m.string);
		var content = /^\s*[\[\]]?\s*(\S+)\s*/.exec(m.string)[1];
		if(isIterative){ //if we're dealing with an iterative
			var currentIndex = i;
			i++; //don't copy the current mustache (because it'll double-scope)
			var endRegex = new RegExp('^\\s*\\]\\s*'+quoteForRegex(content)); //generate the regex that finds the corresponding end mustache
			for(var scopedMustaches = [];!(endRegex.test(mustaches[i].string));i++){
				scopedMustaches.push(mustaches[i]); //copy until you find what you want
			}
			var internalScope = buildScopes(scopedMustaches); //and compile them into a single wrapped.. thing
			scope.push({
				string:content,
				scope:internalScope
			});
		} else {
			scope.push(m);
		}
	}
	return scope;
}
function dotsToBrackets(dots){
	return dots.map(function(v){return '["'+v+'"]'}).join("")
}
function buildParsedExpr(expr){ 
	var clean = expr.replace(/\s/g,''); // toss whitespace (do I need this? eh, whatevs)
	var splitRegex = /#\((.*)\).?|(.+?)(?:\.|$)/g; //just put it into Regexper
	var words = getAllMatches(
		splitRegex,
		clean,
		function(res){
			return res[1]||res[2] //classic JS, obv
	});
	
	var dots = dotsToBrackets(words); // convert the terms to brackets for indexing
	splitRegex.lastIndex = 0; // reset stupid regexes
	var fn;
	if(splitRegex.exec(clean)[1]){ // if indirect (hashed)
		fn = new Function("_,gen",'return gen'+dots); // build the function responsible for indexing the environment provided
	}else{ // if direct
		fn = new Function("ext",/*,gen*/  //do the same as above, but for direct accesses
			"return ext"+dots
		);
	}
	
	fn.words = words;
	fn.dotsToBrackets = dotsToBrackets;
	return fn;
}
function defTrans(v){return v}
function defFnTrans(fn){return function(v){return fn(v)}}
function buildFn(scope,inTransform,outTransform){
	var inTransform = inTransform || defTrans;
	var outTransform = outTransform || defFnTrans;
	var builtFns = scope.map(outTransform(function(v){
		var v = inTransform(v);
		if(v.data) //literal
			return function(){return""+v.data}; // ! c
		else { //parser-required
			var expr = buildParsedExpr(v.string);
			if(v.index){ //mustache
				return function(ext,gen){ // ! c
					return expr(ext,gen);
				}
			}
			if(v.scope){ //iterative
				var innerTemplate = buildFn(v.scope);
				var mustache = v;
				return function(ext,gen){ // ! c
					var obj = expr(ext,gen), s = "";
					for(var i in obj){
						// set up gen-vironment
						gen[mustache.string] = { //this is what you modify to extend the generated environment
							index:i, //which item are we getting?
							item:obj[i]
						};
						s += innerTemplate(ext,gen) // pass the items through
					}
					return s;
				}
			}
			throw"t";
		}
	}));
	
	return function(ext,gen){
		return builtFns.map(function(v){return v(ext,gen||{})}).join("");
	}
}

module.exports = {
	parseTemplate:function(template){
		var mustaches = getMustachesFromTemplate(template);
		var scopes = buildScopes(mustaches);
		return scopes;
	},
	buildFn:buildFn,
	buildParsedExpr:buildParsedExpr
	
}