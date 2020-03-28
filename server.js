// Use the web-push library to hide the implementation details of the communication between the application server and
// the push service. For details, see https://tools.ietf.org/html/draft-ietf-webpush-protocol
// and https://tools.ietf.org/html/draft-ietf-webpush-encryption.
const fs = require('fs');
const webPush = require('web-push');
const {Pool} = require('pg');
const express = require('express');
const bodyParser = require('body-parser');
const numeral = require('numeral');

require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(express.static('app'));

const port = process.env.NODE_PORT;
const subscriptionsTable = process.env.SUBSCRIPTIONS_TABLE;
const apiKey = process.env.FIREBASE_API_KEY;

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
                console.error(err.stack);
            } else {
                // console.log(sqlRes);
            }
            return sqlRes;
        }).then(_then).catch((e) => {
            console.log(e);
            if (_catch) _catch(e);
        });
    });
}

// Set the keys used for encrypting the push messages.
webPush.setVapidDetails(
    'https://serviceworke.rs/',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

webPush.setGCMAPIKey(apiKey);

query(
    `CREATE TABLE IF NOT EXISTS ${subscriptionsTable} (id varchar(2100) PRIMARY KEY, subscription text)`,
    [],
    (sqlRes) => {
        console.log(sqlRes);
        console.log(`Using ${subscriptionsTable}`);
    },
    (e) => {
        console.error(`Error while trying to initialize DB with table ${subscriptionsTable}.`, e);
    }
);

app.get('/vapidPublicKey', function (req, res) {
    res.send(process.env.VAPID_PUBLIC_KEY);
});

app.post('/register', function (req, res) {
    let id = req.body.endpoint;
    query(
        `INSERT INTO ${subscriptionsTable}(id, subscription) VALUES($1, $2)`,
        [id, req.body],
        (sqlRes) => {
            res.sendStatus(200);
        },
        (e) => {
            if (e.code === '23505') {
                console.log('Subscription already exists');
                res.sendStatus(200);
                return;
            }
            res.send(e);
        }
    );
});

app.post('/sendNotificationToAll', function (req, res) {
    const dataPath = './data';
    const entries = fs.readdirSync(dataPath).filter(file => file.endsWith('.json'));
    const file = entries[randomInt(0, entries.length - 1)];
    const filePath = dataPath + '/' + file;
    const contents = JSON.parse(fs.readFileSync(filePath, "utf8"));

    const options = {
        TTL: req.body.ttl,
        gcmAPIKey: apiKey,
    };

    // const subscription = req.body.subscription;
    // const options = {
    //   TTL: req.body.ttl
    // };
    query(
        `SELECT * FROM ${subscriptionsTable}`,
        [],
        (sqlRes) => {
            let rows = sqlRes.rows;
            rows.forEach(row => {
                const subscription = JSON.parse(row.subscription);
                console.log(contents);
                const payload = {
                    title: contents.title,
                    body: `${formatAmount(contents.amount)} per ${contents.period}`,
                };
                webPush.sendNotification(subscription, JSON.stringify(payload), options)
                    .catch(function (error) {
                        console.error(error);
                    });
            });

            res.sendStatus(201);
        },
        (e) => {
            console.error(e);
            res.sendStatus(500);
        }
    );
});

function formatAmount(n) {
    return numeral(n).format('0.0a');
}

function randomInt(start, end) {
    const len = 1 + end - start;
    let rand = Math.floor(Math.random() * len);
    return rand + start;
}

app.listen(port, () => console.log(`Example app listening on port ${port}!`));