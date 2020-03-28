// Use the web-push library to hide the implementation details of the communication between the application server and
// the push service. For details, see https://tools.ietf.org/html/draft-ietf-webpush-protocol
// and https://tools.ietf.org/html/draft-ietf-webpush-encryption.
const webPush = require('web-push');
const {Pool} = require('pg');
const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(express.static('app'));

const port = process.env.NODE_PORT;
const subscriptionsTable = process.env.SUBSCRIPTIONS_TABLE;

if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.log("You must set the VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY " +
      "environment variables. You can use the following ones:");
  console.log(webPush.generateVAPIDKeys());
  return;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true,
  rejectUnauthorized: true,
});

// the pool will emit an error on behalf of any idle clients
// it contains if a backend error or network partition happens
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

function query(q, p, _then, _catch) {
  pool.connect((err, client, done) => {
    if (err) throw err;
    client.query(q, p).then(sqlRes => {
      done();
      if (err) {
        console.log(err.stack);
      } else {
        console.log(sqlRes);
      }
    }).then(_then).catch((e) => {
      console.log(e);
      _catch(e);
    });
  });
}

// Set the keys used for encrypting the push messages.
webPush.setVapidDetails(
    'https://serviceworke.rs/',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

app.get('/vapidPublicKey', function (req, res) {
  res.send(process.env.VAPID_PUBLIC_KEY);
});

app.get('/init_db', function (req, res) {
  query(
      `CREATE TABLE IF NOT EXISTS ${subscriptionsTable} (id varchar(2100) PRIMARY KEY, subscription text)`,
      [],
      (sqlRes) => {
        res.sendStatus(200);
      },
      (e) => {
        res.send(e);
      }
  );
});

app.post('/register', function (req, res) {
  console.log(req.body);
  let id = req.body.endpoint;
  query(
      `INSERT INTO ${subscriptionsTable}(id, subscription) VALUES($1, $2)`,
      [id, req.body],
      (sqlRes) => {
        res.sendStatus(200);
      },
      (e) => {
        res.send(e);
      }
  );
});

app.post('/sendNotification', function (req, res) {
  const subscription = req.body.subscription;
  const payload = null;
  const options = {
    TTL: req.body.ttl
  };

  setTimeout(function () {
    webPush.sendNotification(subscription, payload, options)
        .then(function () {
          res.sendStatus(201);
        })
        .catch(function (error) {
          res.sendStatus(500);
          console.log(error);
        });
  }, req.body.delay * 1000);
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));