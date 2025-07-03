const DATESTR_LOCALE = "ja-JP"; // YYYY/MM/DD
const DATESTR_CONFIG = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "numeric"
};

function dateStrFromUTC(dateStr)
{
    let date = new Date(dateStr + " UTC");
    let config = DATESTR_CONFIG;
    config.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return date.toLocaleString(DATESTR_LOCALE, config);
}

let page = {
    onHashChange()
    {
        let hash = location.hash.replace(/^#!\//, "");
        let parts = hash.split("/");
        this.navigate(parts);
    },

    async navigate(urlParts)
    {
        let pageContent = document.getElementById("page-content");
        let spinner = document.getElementById("spinner");

        pageContent.innerHTML = "";
        pageContent.hidden = true;
        spinner.hidden = false;

        let template = "404";
        let data = {};
        switch (urlParts[0])
        {
            case "":
                template = "home";
                break;
            case "download":
            {
                template = "download";
                let r = await fetch(`https://api.github.com/repos/get-ntmu/NTMU/releases?t=${Date.now()}`);
                if (r.status != 200)
                    break;

                let json;
                try
                {
                    json = await r.json();
                } catch (e) { break; }

                data.releases = [];
                for (const release of json)
                {
                    let rdata = {};
                    rdata.name = release.name;
                    rdata.url = release.html_url;
                    rdata.date =
                        new Date(release.published_at).toLocaleDateString(
                            DATESTR_LOCALE,
                            DATESTR_CONFIG
                        );
                    for (const asset of release.assets)
                    {
                        switch (asset.name)
                        {
                            case "NTMU-x64.zip":
                                rdata.download_x64 = asset.browser_download_url;
                                break;
                        }
                    }
                    data.releases.push(rdata);
                }

                break;
            }
            case "packs":
            {
                template = "packs";
                let r = await fetch(`data/packs.yml?t=${Date.now()}`);
                if (r.status != 200)
                {
                    template = "error";
                    data.message = `Data request for packs list failed with status ${r.status}.`;
                    break;
                }
                let packsText = await r.text();
                let packs;
                try
                {
                    packs = jsyaml.load(packsText);
                }
                catch (e)
                {
                    template = "error";
                    data.message = "Failed to parse data for the packs list";
                    break;
                }
                for (let pack of packs)
                {
                    pack.date = dateStrFromUTC(pack.date);
                }
                data.packs = packs;
                break;
            }
            case "pack":
            {
                let id = urlParts[1];
                if (id === "" || id === undefined)
                    break;

                let r = await fetch(`data/${id}/pack.yml?t=${Date.now()}`);
                if (r.status != 200)
                {
                    if (r.status == 404)
                    {
                        template = "404";
                        break;
                    }
                    template = "error";
                    data.message = `Data request for pack ${id} failed with status ${r.status}`;
                    break;
                }

                let packData;
                try
                {
                    let text = await r.text();
                    packData = jsyaml.load(text);
                } catch (e)
                {
                    template = "error";
                    data.message = `Failed to parse data for pack ${id}`;
                }

                data.pack = packData;
                data.pack.id = id;

                let rr = await fetch(`data/${id}/README.md?t=${Date.now()}`);
                if (rr.status == 200)
                {
                    let parser = new commonmark.Parser();
                    let renderer = new commonmark.HtmlRenderer();
                    let parsed = parser.parse(await rr.text());
                    data.pack.readme = renderer.render(parsed);
                }

                for (let version of data.pack.versions)
                {
                    version.date = dateStrFromUTC(version.date);
                }
    
                template = "pack";
                break;
            }
        }

        pageContent.innerHTML = nunjucks.render(template + ".html", data);
        pageContent.hidden = false;
        spinner.hidden = true;

        switch (urlParts[0])
        {
            case "packs":
                document.querySelector(`.filter-link[data-value="new"]`).classList.add("selected");
                sort("new");
                break;
        }
    },

    init()
    {
        nunjucks.configure("templates", {
            web: { useCache: true }
        });
        window.addEventListener("hashchange", this.onHashChange.bind(this));
        this.onHashChange();
    }
};

page.init();