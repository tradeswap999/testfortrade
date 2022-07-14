const li = document.querySelectorAll(".trade-list ul li")

let removeall = () => {
    for (let remove = 0; remove < li.length; remove++) {
        li[remove].classList.remove("active")
    }
}

for (let i = 0; i < li.length; i++) {
    li[i].onclick = function() {
        removeall()
        li[i].classList.add("active")
    }
}