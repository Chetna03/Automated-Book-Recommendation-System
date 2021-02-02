let puppeteer = require("puppeteer");
let handlebars = require("handlebars");
let path = require("path");
let fs = require("fs");
let prompt = require("prompt-sync")();

let credentialsFile = process.argv[2];

console.log("\n");
const genre = prompt("▶️   Which genre would you like to read?   ");

console.log("\n Great Choice! "+genre);
let login,email,pass,arrayOfObjects;

(async function()
{
    try
    {       
        var templateHtml = fs.readFileSync(path.join(process.cwd(), 'pdfContent.html'), 'utf8');
        var template = handlebars.compile(templateHtml);    

        var options = 
        {
            displayHeaderFooter: false,
            PreferCSSPageSize: true,
            pageSize : "A3",
            color : "red",
            printBackground: true,
            path: 'Recommendations.pdf'
        }

        let data = await fs.promises.readFile(credentialsFile,"utf-8");
        let cred = JSON.parse(data);
        login = cred.login;
        email = cred.email;
        pass = cred.pwd;

        let browser = await puppeteer.launch({
            headless : false,
            defaultViewport : null,
            args : ["--start-maximized", "--disable-notifications"]
        });

        let nop = await browser.pages();
        let tab = nop[0];
    
        tab.setDefaultNavigationTimeout(50000);
        await tab.goto(login, {
            waitUntil: "networkidle2"
        });

        await tab.waitForSelector("#user_email");
        await tab.type("#user_email", email, { delay: 100 });

        await tab.waitForSelector("#user_password");
        await tab.type("#user_password", pass, { delay: 100 });

        await tab.waitForSelector(".gr-button.gr-button--large");

        console.log("\n Please be patient while we fetch some books for you!");

        await navHelper(tab,".gr-button.gr-button--large");

        await tab.goto("https://www.goodreads.com/genres", { waitUntil: "networkidle2" });

        await tab.waitForSelector("#shelf");
        await tab.type("#shelf", genre, { delay: 100 });
        await navHelper(tab,".gr-button.u-marginLeftTiny");

        let manageTabs = await tab.$$(".bigBoxContent.containerWithHeaderContent .moreLink a");
        await Promise.all([manageTabs[1].click(), tab.waitForNavigation({
            waitUntil: "networkidle2"
        })])

        let bookArr = await tab.$$(".coverWrapper a");
    
        let storage = [];

        for(let i=0 ; i<5 ; i++)
        {
            storage[i] = await tab.evaluate(function (q) {
                return q.getAttribute("href");
            }, bookArr[i]);
        }
        
        console.log("\n ⭐ We have found some interesting books for you to read.");
        console.log("\n They'll be ready in a minute..");

        for(let i=0 ; i<5 ; i++)
        {
            await tab.goto(`https://www.goodreads.com${storage[i]}`, {
            waitUntil: "networkidle2"
            });

            await tab.waitForSelector("#bookTitle");
            let bookName = await tab.evaluate(() => document.querySelector('#bookTitle').textContent);
            bookName = bookName.replace(/(\r\n|\n|\r)/gm," ").replace(/'/g, "’").replace(/#/g, "No.").trim();

            await tab.waitForSelector("#bookAuthors .authorName span");
            let authorName = await tab.evaluate(() => document.querySelector('#bookAuthors .authorName span').textContent);
            authorName = authorName.replace(/(\r\n|\n|\r)/gm," ").replace(/'/g, "’").replace(/#/g, "No.").trim();

            await tab.waitForSelector("#bookMeta span[itemprop='ratingValue']");
            let rating = await tab.evaluate(() => document.querySelector('#bookMeta span[itemprop="ratingValue"]').textContent);
            rating = rating.replace(/(\r\n|\n|\r)/gm," ").replace(/'/g, "’").replace(/#/g, "No.").trim();

            let bookCover = await tab.$("#coverImage");
            let image = await tab.evaluate(function (q) {
                return q.getAttribute("src");
            }, bookCover);

            let finalDesc;

            let moreButton = await tab.$("#description a").catch(() => {
            });

            if(moreButton)
            {
                await tab.evaluate(() => { document.querySelector('#description > span:nth-child(2)').style.display = 'inline'; });
                finalDesc = await tab.evaluate(() => document.querySelector("#description span:nth-child(2)").innerText);
                
            }
            else
            {
                finalDesc = await tab.evaluate(() => document.querySelector("#description span:nth-child(1)").innerText);
            }

            finalDesc = finalDesc.replace(/'/g, "’").replace(/#/g, "No.").trim();

            let what = await fs.promises.readFile("books.json","utf-8");
            arrayOfObjects = await JSON.parse(what);
            await arrayOfObjects.bookList.push({
                        bname : bookName,
                        aname: authorName,
                        rate: rating,
                        imgLink : image,
                        desc : finalDesc
                    })

            await fs.writeFile('books.json', JSON.stringify(arrayOfObjects), 'utf-8', function(err) {
                if (err) throw err
            });

        }

        console.log("\n Almost there.....")

        var html = await template(arrayOfObjects);


        await tab.goto(`data:text/html;charset=UTF-8,${html}`, {
            waitUntil: 'networkidle0'
        });
        
        await tab.pdf(options);

        console.log("\n Thanks for your patience!!!")
        console.log("\n ❤️   Your books are waiting for you ❤️")
    }
    catch (err) {
        console.log(err);
    }    
})()

async function navHelper(tab,selector)
{
    await Promise.all([tab.waitForNavigation({
        waitUntil: "networkidle2"
    }),tab.click(selector)]);
}