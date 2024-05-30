const FLOWER_CLASS = {
  0: "daisy",
  1: "dandelion",
  2: "roses",
  3: "sunflowers",
  4: "tulips",
};

const faceMesh = new FaceMesh({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
  },
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

async function render(image) {
  await faceMesh.send({
    image: image,
  });
}

function main() {
  var image = new Image();
  image.crossOrigin = "anonymous";
  image.src = "./IMG_6256.PNG";
  image.onload = function () {
    render(image);
  };
}

main();
// // Load model
//  $("document").ready (async function() {
//     try {
//         const model = await facemesh.load({ maxFaces: 1 });
//         console.log("Model loaded successfully");
//         const imageElement = document.getElementById('test_img');
//        console.log(model.estimateFaces(imageElement))
//     } catch (error) {
//         console.error("Error loading the model:", error);
//     }
//     // async function detectFace(imageElement) {
//     //         // Chọn mô hình MediaPipeFaceMesh
//     //         const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;

//     //         // Cấu hình detector
//     //         const detectorConfig = {
//     //             runtime: 'mediapipe', // Hoặc 'tfjs'
//     //             solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh', // Đường dẫn đến mô hình
//     //         };

//     //         // Tạo detector
//     //         const detector = await faceLandmarksDetection.createDetector(model, detectorConfig);

//     //         // Nhận diện khuôn mặt
//     //         const faces = await detector.estimateFaces(imageElement);

//     //         // Xử lý kết quả
//     //         faces.forEach((face, index) => {
//     //             console.log(`Khuôn mặt ${index + 1}:`);
//     //             console.log('Bounding box:', face.box);
//     //             console.log('Keypoints:', face.keypoints);
//     //         });
//     // }

//     // // Sử dụng hàm detectFace với phần tử hình ảnh của bạn
//     // const imageElement = document.getElementById('test_img'); // Thay thế bằng phần tử hình ảnh của bạn
//     // detectFace(imageElement);
// });

$("#upload_button").click(function () {
  $("#fileinput").trigger("click");
});

async function setupFaceDetector() {
  const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
  const detector = await faceLandmarksDetection.createDetector(model, {
    runtime: "mediapipe",
    solutionPath: `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh`,
    maxFaces: 2,
    refineLandmarks: true,
  });
  return detector;
}

async function predict() {
  // 1. Chuyen anh ve tensor
  let image = document.getElementById("display_image");
  let img = tf.browser.fromPixels(image);
  let normalizationOffset = tf.scalar(255 / 2); // 127.5
  let tensor = img
    .resizeNearestNeighbor([224, 224])
    .toFloat()
    .sub(normalizationOffset)
    .div(normalizationOffset)
    .reverse(2)
    .expandDims();

  // 2. Predict
  let predictions = await model.predict(tensor);
  predictions = predictions.dataSync();
  console.log(predictions);
}

$("#fileinput").change(function () {
  let reader = new FileReader();
  reader.onload = function () {
    let dataURL = reader.result;

    imEl = document.getElementById("display_image");
    imEl.onload = function () {
      predict();
    };
    $("#display_image").attr("src", dataURL);
    $("#result_info").empty();
  };

  let file = $("#fileinput").prop("files")[0];
  reader.readAsDataURL(file);
});
