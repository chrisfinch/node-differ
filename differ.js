var request = require('request');
var fs = require('fs');
var jsdiff = require('diff');
var nodemailer = require('nodemailer');

var express = require('express')
var app = express()

app.use(express.static('files'));
app.use(express.static('patches'));

var lastCheckedDate = null;

app.get('/', function (req, res) {
  
    var page = [];

    page.push('All is well!');
    page.push('Last checked: ' + lastCheckedDate.toDateString() + ' ' + lastCheckedDate.toTimeString());

    res.send(page.join('\n\r'))
})

var server = app.listen(3000, function () {

    var host = server.address().address
    var port = server.address().port

    console.log('Node Mailer app listening at http://%s:%s', host, port)
});

// create reusable transporter object using SMTP transport
var transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: 'chris.node.mailer@gmail.com',
        pass: 'chris.node.mailer123'
    }
});

//require the Twilio module and create a REST client
var twilio = require('twilio')('AC8e0a2e32c7e16f23615f7365a6c47cd2', '10d76e8e4f5b6a1d88d649fea6596db5');

function diffAndSendMail () {

    var d = new Date();

    console.log('>> (' + d.toDateString() + ' ' + d.toTimeString() + ') Running ====================');

    var req = request('http://www.cic.gc.ca/english/work/iec/data.xml')
        .pipe(fs.createWriteStream('files/current.xml'));

    req.on('finish', function () {

        fs.readFile('files/current.xml', 'utf8', function (err, data) {

            var current = data;

            console.log('>> Loaded current');

            fs.readFile('files/latest.xml', 'utf8', function (err, data) {

                lastCheckedDate = new Date();

                var latest = data;

                console.log('>> Loaded latest');

                var diff = jsdiff.diffWords(latest, current);

                var different = false;

                diff.forEach(function (d) {
                    if (d.added || d.removed) {
                        different = true;
                    }
                });

                if (different) {
                    
                    console.log(">> Files are different...");
                    console.log('>> Building mail');
                    
                    var patch = jsdiff.createPatch('files/diff.patch', latest, current);

                    //Send an SMS text message
                    twilio.sendMessage({

                        to:'+447807006645', // Any number Twilio can deliver to
                        from: '+441877221022', // A number you bought from Twilio and can use for outbound communication
                        body: 'Diff found at http://www.cic.gc.ca/english/work/iec/index.asp?country=gb&cat=wh' // body of the SMS message

                    }, function(err, responseData) { //this function is executed when a response is received from Twilio

                        if (!err) {
                            console.log('Text message sent');
                        } else {
                            console.log(err);
                        }
                    });

                    // send mail with defined transport object
                    var mailOptions = {
                        from: 'Chris Node Mailer <chris.node.mailer@gmail.com>',
                        to: 'chrisfinchy@gmail.com, m.h.c.vdlingen@gmail.com',
                        subject: 'Change detected in CIC xml file by Chris\'s application',
                        text: patch
                    };

                    transporter.sendMail(mailOptions, function(error, info) {
                        if (error) {
                            console.log(error);
                        } else {
                            console.log('Email sent: ' + info.response);

                            updateFileConfiguration();

                            var d = new Date();

                            fs.writeFile('patches/' + (d.toDateString() + d.toTimeString()).replace(/\s/g, '-') + '.patch', patch);
                        }
                    });
                } else {
                    console.log(">> Files are the same");
                }
            });
        })
    });
}

function updateFileConfiguration () {

    fs.unlink('files/latest.xml', function () {

        fs.rename('files/current.xml', 'files/latest.xml', function () {
            console.log('>> Files moved');
        });
    });
}

diffAndSendMail();

setInterval(diffAndSendMail, 60 * 1000);
