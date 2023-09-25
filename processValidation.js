import fs from "fs"
import { execSync, exec } from "child_process"
import http from "http"

const shapes = {
  "skos.shacl.ttl": "shapes/skos.shacl.ttl",
}

const service_name = "fuseki_skohub_validate"
const runDocker = `
    docker run -d --rm --name ${service_name} -p 3030:3030 \
    -v $(pwd)/fuseki/config_inference.ttl:/fuseki/config_inference.ttl \
    skohub/jena-fuseki:latest /jena-fuseki/fuseki-server \
    --config /fuseki/config_inference.ttl
`

const dockerRunning = `
if docker ps | grep -q "${service_name}"; then
  docker stop ${service_name}
sleep 1
fi
`

const dockerStop = `
docker container stop ${service_name}
`


/**
 * @returns {string}
 */
function getShape(req) {
  if (req?.files?.["shapeFile"]?.[0] !== undefined) {
    const shape = fs.readFileSync(req.files["shapeFile"][0].path)
    return shape
  } else if (req?.body?.shape !== undefined) {
    const shape = fs.readFileSync(shapes[req.body.shape])
    return shape
  } else {
    throw new Error("Neither shape file nor shape info provided.")
  }
}

function getFileToValidate(req) {
  if (req?.files?.["toValidate"]?.[0] !== undefined) {
    const toValidate = fs.readFileSync(req?.files?.["toValidate"]?.[0].path)
    return toValidate
  } else {
    throw new Error("No file to validate")
  }
}

/**
  * @returns {boolean}
  */
export async function processValidation(req) {
  const toValidate = getFileToValidate(req)
  const shape = getShape(req)
  // check if a instance is already running, if so, kill it
  execSync(dockerRunning, (error, stdout, stderr) => {
    if (error) {
      console.log(`error: ${error.message}`)
    }
    if (stderr) {
      console.log(`stderr: ${stderr}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
  })
  // start docker container
  execSync(runDocker, (error, stdout, stderr) => {
    if (error) {
      console.log(`error: ${error.message}`)
    }
    if (stderr) {
      console.log(`stderr: ${stderr}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
  })
  // check that container is up
  //
  async function pingEndpoint(url, retries = 5) {
    return new Promise((resolve, reject) => {
      let attempts = 0;

      function sendRequest() {
        attempts++;

        const req = http.get(url, (res) => {
          if (res.statusCode === 200) {
            resolve('Ping successful');
          } else {
            reject(`Unexpected status code: ${res.statusCode}`);
          }
        });

        req.on('error', (err) => {
          if (attempts < retries) {
            console.log("erroor")
            setTimeout(sendRequest, 1000); // Wait for 1 second before sending the next request
          } else {
            reject(`Failed to ping endpoint after ${retries} attempts: ${err.message}`);
          }
        });
      }

      sendRequest();
    });
  }
  try {
    const res = await pingEndpoint('http://localhost:3030/$/ping', 5)
    console.log(res);
  } catch (error) {
    console.error(error);
  }
  // send requests and validate
  const optionsUp = {
    method: 'POST',
    headers: { 'Content-Type': 'text/turtle' },
    body: toValidate
  };
  await fetch('http://localhost:3030/dataset/data?graph=default', optionsUp)
  // validate
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'text/turtle' },
    body: shape
  };
  const validationResult = await (await fetch('http://localhost:3030/dataset/shacl?graph=default', options)).text()

  //shut down container 
  exec(dockerStop, (error, stdout, stderr) => {
    if (error) {
      console.log(`error: ${error.message}`)
    }
    if (stderr) {
      console.log(`stderr: ${stderr}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
  })

  // if no output is produced return 200
  const lengthValidFile = 9
  const lengthFileToValidate = validationResult.split("\n").length
  // else check output for warning and errors
  //
  // return 400 and attach the output to the response
}

