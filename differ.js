var request = require('request');
var fs = require('fs');
var jsdiff = require('diff');
var nodemailer = require('nodemailer');

// create reusable transporter object using SMTP transport
var transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: 'chris.node.mailer@gmail.com',
        pass: 'chris.node.mailer123'
    }
});

function diffAndSendMail () {

    console.log('>> Running...');

    var req = request('http://www.cic.gc.ca/english/work/iec/data.xml')
        .pipe(fs.createWriteStream('files/current.xml'));

    req.on('finish', function () {

        fs.readFile('files/current.xml', 'utf8', function (err, data) {

            var current = data;

            console.log('>> Loaded current');

            fs.readFile('files/latest.xml', 'utf8', function (err, data) {

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

                    var mailOptions = {
                        from: 'Chris Node Mailer <chris.node.mailer@gmail.com>', // sender address
                        to: 'chrisfinchy@gmail.com', // list of receivers
                        subject: 'Change detected in CIC xml file', // Subject line,
                        text: patch
                    };

                    // send mail with defined transport object
                    transporter.sendMail(mailOptions, function(error, info) {
                        if (error) {
                            console.log(error);
                        } else {
                            console.log('Email sent: ' + info.response);

                            updateFileConfiguration();

                            fs.writeFile('patches/' + (new Date()).toDateString().replace(/\s/g, '-') + '.patch');
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
            console.log('files moved');
        });
    });
}

diffAndSendMail();

setInterval(diffAndSendMail, 60 * 1000);
