import fs from "fs"
import { execSync, exec } from "child_process"
import http from "http"

// TODO 
// add a port range or chain requests, because multiple requests will lead to race conditions

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
sleep 2
fi
`

const dockerStop = `
docker container stop ${service_name}
`


/**
 * @returns {Buffer}
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

/**
 * @returns {Buffer}
 */
function getFileToValidate(req) {
  if (req?.files?.["toValidate"]?.[0] !== undefined) {
    const toValidate = fs.readFileSync(req?.files?.["toValidate"]?.[0].path)
    return toValidate
  } else {
    throw new Error("No file to validate")
  }
}

/**
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
  const serverUrl = 'http://localhost:3030/$/ping';
  const maxRetries = 5;

  function pingServer() {
    return new Promise((resolve, reject) => {
      http.get(serverUrl, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`Server returned status code ${res.statusCode}`));
        }
      }).on('error', (err) => {
        reject(err);
      });
    });
  }

  async function waitForServer() {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        await pingServer();
        console.log('Server is online');
        break;
      } catch (err) {
        console.log(`Error: ${err.message}`);
        retries++;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    if (retries === maxRetries) {
      throw new Error('Server is offline');
    }
  }

  await waitForServer();
  // send requests and validate
  // TODO add class definitions when checking against basis skos shape
  const classDefinition = fs.readFileSync("./shapes/classAndPropertyDefinitions.ttl")
  const optionsClassProps = {
    method: 'POST',
    headers: { 'Content-Type': 'text/turtle' },
    body: classDefinition
  };
  await fetch('http://localhost:3030/dataset/data?graph=default', optionsClassProps)

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
  if (lengthFileToValidate > lengthValidFile) {
    console.log("errors \n", validationResult)
    return { valid: false, result: validationResult }
  } else {
    console.log("no errors \n", validationResult)
    return { valid: true, result: validationResult }
  }
}

