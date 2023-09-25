import https from 'https';
import fs from 'fs';

const url = 'https://raw.githubusercontent.com/skohub-io/shapes/main/skos.shacl.ttl';


https.get(url, (res) => {
  if (res.statusCode == 404) {
    throw new Error("404, not found")
  } else {
    res.on('data', (chunk) => {
      fs.writeFile('shapes/skos.shacl.ttl', chunk, (err) => {
        if (err) console.error(err);
      });
    });
  }
  console.log('File saved to disk');
}).on('error', (err) => {
  console.error(err);
  throw new Error
});

