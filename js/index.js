const searchinput = document.querySelector(".search");
const searchnotfound = document.querySelector(".notfound");

const before = document.querySelector(".fa-angle-left");
const after = document.querySelector(".fa-angle-right");
const numbertxt = document.querySelector(".number");

const customers = document.querySelectorAll(".customers");
const number = document.querySelector(".number");
const number2 = document.querySelector(".number2");

let a = 0;
number2.textContent = `${customers.length}`;
customers[a].style.display = "block";

after.addEventListener("click", () => {
    console.log(a);
    customers[a].style.display = "none";
    if (a < customers.length - 1) {
        a = a + 1;
        number.textContent = `${a + 1}`;
    }
    customers[a].style.display = "block";
});
before.addEventListener("click", () => {
    console.log(a);
    customers[a].style.display = "none";
    if (a > 0) {
        a = a - 1;
        number.textContent = `${a + 1}`;
    }
    customers[a].style.display = "block";
});

searchinput.onchange = function() {
    if (searchinput.value.length > 0) {
        customers[a].style.display = "none";
        searchnotfound.style.display = "block";
    } else {
        searchnotfound.style.display = "none";
        customers[a].style.display = "block";
    }
};