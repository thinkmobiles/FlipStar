/**
 * Created by eriy on 02.07.15.
 */

/* Database Settings */
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_NAME = process.env.DB_NAME || 'FlipStar';
process.env.DB_PORT = process.env.DB_PORT || 5432;
process.env.DB_USER = process.env.DB_USER || 'postgres';
process.env.DB_PASS = process.env.DB_PASS || 'postgres';

/* App Settings */
process.env.PORT = process.env.PORT || 8840;
process.env.HOST = process.env.HOST || 'http://134.249.164.53:8840';

/* Redis Settings*/
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || 6379;
process.env.REDIS_DB = process.env.REDIS_DB || 3;

/* Session settings */
process.env.SESSION_SECRET = 'change this secret';
process.env.SESSION_HOST = process.env.SESSION_HOST || 'localhost';
process.env.SESSION_DB = process.env.SESSION_DB || 3;
process.env.SESSION_PORT = process.env.SESSION_PORT || 6379;

/* RabbitMQ settings */

//process.env.BROKER_TYPE = 'publisher';
process.env.RABBITMQ_HOST = process.env.RABBITMQ_HOST || 'localhost';
//process.env.RABBITMQ_HOST = '192.168.88.250';
process.env.RABBITMQ_PORT = 5672;
process.env.RABBITMQ_USER = 'user';
process.env.RABBITMQ_PASSWORD = 'user';

/* kafka Server*/

process.env.KAFKA_HOST = 'localhost';
process.env.KAFKA_PORT = 2181;