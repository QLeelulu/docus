var app = require('./main.js').app;

app.listen(8080, function(err){
    err && console.error(err);
});
