const hide = document.querySelector(".hide");
const button = document.querySelector(".thismenu");

button.addEventListener("click", () => {
    if (hide.style.display === "block") {
        hide.style.display = "none";
    } else if ((hide.style.display = "block")) {
        console.log("block");
    }
});