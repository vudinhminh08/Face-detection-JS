const MODEL_URL = "models";

const webcamElement = document.getElementById("webcam");
const canvasElement = document.getElementById("canvas");

const webcam = new Webcam(webcamElement, "user", canvasElement);
const imageElement = document.getElementById("captured-image");
const imagesContainer = document.getElementById("images-container");
const captureButton = document.getElementById("captureButton");
$(document).ready(function () {
  console.log("start");
  load_model();
  webcam
    .start()
    .then((result) => {
      console.log("webcam started");
    })
    .catch((err) => {
      console.log(err);
    });
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
image_list = [];
count = 0;
state = "";
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
  const img = await faceapi.bufferToImage(blob);

  const detections = await faceapi
    .detectAllFaces(img)
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
