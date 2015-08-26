/**
 * Created by Roman on 23.12.2014.
 */
"use strict";

var cluster = require( 'cluster' );
var interval;
var counter = 0;

process.env.NODE_ENV = 'development';

if (process.env.NODE_ENV) {
    require('./config/' + process.env.NODE_ENV.toLowerCase());
} else {
    process.env.NODE_ENV = 'production';
    require('./config/production');
}

/*if( cluster.isMaster ) {

    var cpuCount = require( 'os' ).cpus().length;


    interval = setInterval(function(){
        if (counter < cpuCount){
            cluster.fork();  
            counter += 1;
        } else {
            clearInterval(interval);   
        }
        
    }, (Math.random() * 30000) | 0 );


    

    cluster.on( 'exit', function ( worker ) {
        console.log( 'Worker ' + worker.id + ' died :(' );
        cluster.fork();
    } );

    cluster.on( 'online', function ( worker ) {
        console.log( "The worker" + worker.id + " responded after it was forked" );
    } );

    cluster.on( 'listening', function ( worker, address ) {
        console.log( "A worker " + worker.id + " is now connected to " + address.address + ":" + address.port );
    } );

} else {*/
    require('./server');
/*}*/
