/**
 * Created by eriy on 02.07.15.
 */

/* Database Settings */
process.env.DB_HOST = 'localhost';//process.env.DB_HOST || '192.168.88.250';
process.env.DB_NAME = process.env.DB_NAME || 'FlipStar';
process.env.DB_PORT = process.env.DB_PORT || 5432;
process.env.DB_USER = process.env.DB_USER || 'postgres';
process.env.DB_PASS = process.env.DB_PASS || 'postgres';

/* App Settings */
process.env.PORT = process.env.PORT || 8840;
process.env.PORT_HTTPS = process.env.PORT_HTTPS || 8840;
process.env.HOST = process.env.HOST || 'http://projects.thinkmobiles.com:8840';

/* Redis Settings*/
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = parseInt( process.env.REDIS_PORT ) || 6379;
process.env.REDIS_DB = parseInt( process.env.REDIS_DB ) || 3;

/* Session settings */
process.env.SESSION_SECRET = 'change this secret';
process.env.SESSION_HOST = process.env.SESSION_HOST || 'localhost';
process.env.SESSION_DB = parseInt( process.env.SESSION_DB ) || 3;
process.env.SESSION_PORT = parseInt ( process.env.SESSION_PORT ) || 6379;

/* Socket Redis */
process.env.SOCKET_DB_HOST = process.env.SOCKET_DB_HOST || 'localhost';
process.env.SOCKET_DB_PORT = parseInt( process.env.SOCKET_DB_PORT ) || 6379;
process.env.SOCKET_DB = parseInt( process.env.SOCKET_DB ) || 3;

/* kafka Server*/

process.env.KAFKA_HOST = '192.168.88.250';
/*process.env.KAFKA_HOST = 'localhost';*/
process.env.KAFKA_PORT = 2181;

/*facebook notifications*/
process.env.ACCESS_TOKEN = '1614729755469346|c462fed603a417b2874885c5977a7c0b';