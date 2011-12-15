var app = require('./main.js').app;

app.listen(80, function(err){
    err && console.error(err);
});
