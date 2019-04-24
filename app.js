// Módulos e Dependências
var express = require('express'),
    ejs = require('ejs'),
    http = require('http'),
    app = express(),
//    enforce = require('./enforce'),
    compress = require('compression'),
    bodyParser = require('body-parser');

// Configurações Globais (Express)
//app.configure(function(){

app.engine('.html', ejs.renderFile );
    app.use(compress());
    app.use(bodyParser.json());
//    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(express.static( "richchat", { maxAge: 0 } ));

    app.set('views', __dirname + '/richchat');
    app.set('port', process.env.PORT || 4000);
//});

//// Configurações do Ambiente de Desenvolvimento (Express)
//app.configure('development', function(){
//});
//
//// Configuração do Ambiente de Produção (Express)
//app.configure('production', function(){
//});
//
//// Configuração do Ambiente de Pré Produção (Express)
//app.configure('devteste', function(){
////    app.use(enforce.HTTPS());
//});

app.get('/',function(req,res){
    res.header('Cache-Control','no-cache');
    res.header('Expires','0');
    res.render('index.html');
});

app.get('/erro',function(req,res){
    res.header('Cache-Control','no-cache');
    res.header('Expires','0');
    res.render('error.html');
});

// Iniciando Socket.io sincronizado com Express
var servidor = http.createServer(app).listen(app.get('port'),
    function(){
        //console.log("Servidor iniciado na porta: " + app.get('port'));
        console.log('Servidor Devestudio WEB executando na Porta: %d (Ambiente: %s)\nHora atual: %s', app.get('port'), app.settings.env, Date(Date.now()));
    }
);