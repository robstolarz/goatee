var fs = require('fs'), Goatee = require('../goatee.js');

// read in template from file system
var templateString = new String(fs.readFileSync('./edit-order.gte'));

// parse the template into an AST
var ast = Goatee.parseTemplate(templateString);

// use AST to build JS function that outputs a finished product
var templateFn = Goatee.buildFn(ast);

// grab sample data
var data = JSON.parse(new String(fs.readFileSync('./sample.json')));

// put the data in the completed function (which can be repeated for any set of data, quickly)
var output = templateFn(data);

// put it in a file so we can see what's going on!
var outFile = require('path').normalize('./generated.html');
fs.writeFileSync(outFile, output);

console.log('! Wrote file to '+outFile);

