const https = require('https');

function testLiveLogin() {
  const data = JSON.stringify({
    username: 'invalid_user_test',
    password: 'some_password',
    remember: true
  });

  const options = {
    hostname: 'hazelwhat.com',
    port: 443,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = https.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log('Headers:');
    console.log(JSON.stringify(res.headers, null, 2));

    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
    });

    res.on('end', () => {
      console.log('Body:', body);
    });
  });

  req.on('error', (e) => {
    console.error('Request Error:', e);
  });

  req.write(data);
  req.end();
}

testLiveLogin();
