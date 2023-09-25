import express from 'express'
import multer from 'multer'
import { exec } from "child_process"
import { processValidation } from "./processValidation.js"

const upload = multer({
  dest: 'uploads/'
})

const app = express()
const port = 3000

app.get('/', (req, res) => res.send('Hello World!!'))

const cpUpload = upload.fields([
  {
    name: "toValidate", maxCount: 1
  },
  {
    name: "shapeFile", maxCount: 1
  }
])
app.post("/", cpUpload, (req, res, next) => {
  processValidation(req)
  res.send("ok")
})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))

