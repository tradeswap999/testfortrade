const video = document.querySelector("video");
const forplay = document.querySelector(".btn-video-link");
const body = document.body;
const back = document.querySelector(".blurback");
const topz = document.querySelector(".videoforimg");

forplay.addEventListener("click", () => {
    video.style.display = "block";
    back.style.display = "block";
    video.play();
});

back.onclick = function() {
    video.style.display = "none";
    back.style.display = "none";
    video.pause();
};