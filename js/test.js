const MODEL_URL = "models";
image_list = [];
count = 0;

const webcamElement = document.getElementById("webcam");
const canvasElement = document.getElementById("canvas");
const context = canvasElement.getContext("2d");

const webcam = new Webcam(webcamElement, "user", canvasElement);
const imageElement = document.getElementById("captured-image");
const imagesContainer = document.getElementById("images-container");
const captureButton = document.getElementById("captureButton");
const notification = document.querySelector("h1.notification");
$(document).ready(function () {
  console.log("start");
  Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
    faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
    faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
    faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
    faceapi.nets.faceExpressionNet.loadFromUri("/models"),
  ]).then(startWebcam);
});
function startWebcam() {
  webcam
    .start()
    .then((result) => {
      console.log("Webcam started");
    })
    .catch((err) => {
      console.error(err);
    });
}
webcamElement.addEventListener("play", () => {
  canvas = faceapi.createCanvas(webcamElement);
  document.body.append(canvas);
  const displaySize = {
    width: webcamElement.width,
    height: webcamElement.height,
  };
  faceapi.matchDimensions(canvas, displaySize);

  setInterval(async () => {
    const detections = await faceapi
      .detectAllFaces(webcamElement, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceExpressions();
    if (detections.length > 0) {
      let x_head = detections[0].detection._box._x;
      let y_head = detections[0].detection._box._y;
      let area_head = detections[0].detection._box.area;
      if (
        x_head < displaySize.width / 6 ||
        y_head < displaySize.height / 6 ||
        x_head > displaySize.width / 1.5 ||
        y_head > displaySize.height / 1.5 ||
        area_head < (displaySize.width * displaySize.height) / 12 ||
        area_head > (displaySize.width * displaySize.height) / 2
      ) {
        console.log("Please insert your head in the correct position");
      }
    }
    // const resizedDetections = faceapi.resizeResults(detections, displaySize);
    // canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    // faceapi.draw.drawDetections(canvas, resizedDetections);
    // faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
    // faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
  }, 100);
});

async function load_model() {
  console.log(" load start");
  await faceapi.loadSsdMobilenetv1Model(MODEL_URL);
  await faceapi.loadFaceLandmarkModel(MODEL_URL);
  await faceapi.loadFaceRecognitionModel(MODEL_URL);
  await faceapi.loadFaceExpressionModel(MODEL_URL);
  console.log(" load end");
}
function getTop(l) {
  return l.map((a) => a.y).reduce((a, b) => Math.min(a, b));
}

function getMeanPosition(l) {
  return l
    .map((a) => [a.x, a.y])
    .reduce((a, b) => [a[0] + b[0], a[1] + b[1]])
    .map((a) => a / l.length);
}

function detectHeadpose(res) {
  let state_img = "CAN_NOT_DETECT";
  if (res) {
    var eye_right = getMeanPosition(res.landmarks.getRightEye());
    var eye_left = getMeanPosition(res.landmarks.getLeftEye());
    var nose = getMeanPosition(res.landmarks.getNose());
    var mouth = getMeanPosition(res.landmarks.getMouth());
    var jaw = getTop(res.landmarks.getJawOutline());

    var rx = (jaw - mouth[1]) / res.detection.box.height + 0.5;
    var ry =
      (eye_left[0] + (eye_right[0] - eye_left[0]) / 2 - nose[0]) /
      res.detection.box.width;

    // console.log(
    //   res.detection.score, //Face detection score
    //   ry, //Closest to 0 is looking forward
    //   rx // Closest to 0.5 is looking forward, closest to 0 is looking up
    // );
    if (res.detection.score > 0.8) {
      state_img = "FRONT";
      if (rx > 0.2) {
        state_img = "TOP";
      } else if (rx < 0) {
        state_img = "BOTTOM";
      } else {
        if (ry < -0.04) {
          state_img = "RIGHT";
        }
        if (ry > 0.04) {
          state_img = "LEFT";
        }
      }
    }
  } else {
    let expressions = res.expressions;
    let isFaceExpression = Object.values(expressions).some((x) => x > 0.9);
    if (!isFaceExpression || res[0].landmarks.positions.length < 67) {
      state = "UNCLEAR_FACE";
    }
  }
  return state_img;
}

async function capture() {
  var picture = webcam.snap();
  const base64Response = await fetch(picture);
  const blob = await base64Response.blob();

  const img1 = new Image();
  img1.src = URL.createObjectURL(blob);

  img1.onload = function () {
    let mat = cv.imread(img1);
    cv.cvtColor(mat, mat, cv.COLOR_RGBA2GRAY);
    const resolution = { width: mat.cols, height: mat.rows };
    let mean = new cv.Mat();
    let meanScalar = cv.mean(mat);
    const brightness = meanScalar[0];
    mat.delete();
    mean.delete();
    console.log("Resolution:", resolution);
    console.log("Brightness:", brightness);
  };
  const img = await faceapi.bufferToImage(blob);

  const detections = await faceapi
    .detectAllFaces(img, new faceapi.SsdMobilenetv1Options())
    .withFaceLandmarks()
    .withFaceExpressions()
    .withFaceDescriptors()
    .then((res) => {
      if (res.length > 1) {
        state = "TWO_PEOPLE";
      } else if (res.length == 0) {
        state = "CAN_NOT_DETECT";
      } else if (res.length == 1) {
        state = detectHeadpose(res[0]);
      } else {
        state = "ERROR";
      }
      if (
        state != "ERROR" &&
        state != "CAN_NOT_DETECT" &&
        state != "TWO_PEOPLE" &&
        count < 5
      ) {
        if (image_list.length > 0) {
          let distance = faceapi.euclideanDistance(
            res[0].descriptor,
            image_list[0].descriptor
          );
          console.log(distance);
          if (distance > 0.5) {
            state = "NOT_MATCH_FACE";
          } else {
            if (
              (state == "TOP" && image_list.length == 1) ||
              (state == "BOTTOM" && image_list.length == 2) ||
              (state == "RIGHT" && image_list.length == 3) ||
              (state == "LEFT" && image_list.length == 4)
            ) {
              image_list.push(res[0]);
              count++;
            } else state = "NOT_CORRECT_POSE";
          }
        } else {
          if (state == "FRONT" && image_list.length == 0) {
            image_list.push(res[0]);
            count++;
          } else {
            state = "NOT_CORRECT_POSE";
          }
        }
      }
      if (count >= 5) captureButton.disabled = true;
      else captureButton.disabled = false;
      console.log(image_list);
      console.log(state);
    });
}

// if (detections) {
//   // Tạo một thẻ <img> mới và thêm vào DOM
//   // detectHeadpose(detections.landmarks);
//   const canvas = faceapi.createCanvasFromMedia(img);

//   document.body.append(canvas);
//   // Current size of our video
//   const displaySize = { width: img.width, height: img.height };
//   faceapi.matchDimensions(canvas, displaySize);
//   const resizedDetections = faceapi.resizeResults(detections, displaySize);
//   // get 2d context and clear it from 0, 0, ...
//   canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
//   faceapi.draw.drawDetections(canvas, resizedDetections);
//   faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
//   const capturedImage = document.createElement("img");
//   capturedImage.src = picture;
//   capturedImage.alt = "Captured Image";

//   if (imagesContainer.childNodes.length > 0) {
//     // Nếu đã có ảnh trước đó, thêm ảnh mới lên trên cùng
//     imagesContainer.insertBefore(
//       capturedImage,
//       imagesContainer.childNodes[0]
//     );
//   } else {
//     // Nếu không có ảnh nào trong container, thêm ảnh vào container
//     imagesContainer.appendChild(capturedImage);
//   }
// } else {
//   console.log("No face detected.");
// }
