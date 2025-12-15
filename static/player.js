
    const bass = new Audio();
    const drums = new Audio();
    const other = new Audio();
    const vocals = new Audio();

    async function getStem(query, source="soundcloud") {

        const response = await fetch("/stem?query=" + encodeURIComponent(query));
        const data = await response.json();

        //fully loading audio to prevent desync and lag

        const bassReq = await fetch(data.bass);
        const bassBlob = await bassReq.blob();
        bass.src = URL.createObjectURL(bassBlob);

        const drumsReq = await fetch(data.drums);
        const drumsBlob = await drumsReq.blob();
        drums.src = URL.createObjectURL(drumsBlob);

        const vocalsReq = await fetch(data.vocals);
        const vocalsBlob = await vocalsReq.blob();
        vocals.src = URL.createObjectURL(vocalsBlob);

        const otherReq = await fetch(data.other);
        const otherBlob = await otherReq.blob();
        other.src = URL.createObjectURL(otherBlob);

    }

    document.addEventListener("DOMContentLoaded", recieveStems); //loading stems after website has loaded

    const stems = [];
    var editingID = -1;
    var nowPlaying = -1;
    var isPlaying = false;
    var isLoading = false;
    var syncInterval;

    document.querySelector(".newstem").addEventListener("click", createStem);
    document.querySelector(".control.next").addEventListener("click", nextStem);
    document.querySelector(".control.prev").addEventListener("click", lastStem);

    bass.addEventListener("ended", nextStem);

    //BEGIN REST WRAPPER FUNCTIONS
    
    async function recieveStems() {
        console.log("load");
        const request = await fetch("/api/userstems");
        if(request.ok) {
            const content = await request.json();
            content.forEach(element => {
                stems.push(element);
                let elementData;
                try {
                    elementData = JSON.parse(element["data"]);
                } catch (error) {
                    elementData = {};
                }

                addStem((!(elementData?.info?.title ?? null)) ? "Untitled": elementData.info.title, element["id"]);
            });
        }
    }

    async function editStem(id, content) {
        const request = await fetch("/api/editstem", {
            method: 'POST',
            headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
            },
            body: JSON.stringify({"content": content, "id": id})
        });

        if(request.ok) {
            const localStem = findStem(id);
            const songElement = document.querySelector(`.song[stemid="${id}"]`);
            stems[localStem]["data"] = content;
            try {
                const json = JSON.parse(content);
                if(json?.info?.title) {
                    songElement.querySelector(".title").innerText = json.info.title;
                }
                songElement.querySelector(".error").classList.add("hidden");
            } catch (e) {
                songElement.querySelector(".error").classList.remove("hidden");
                console.log(e);
            }
        }
    }

    async function createStem() {
        const request = await fetch("/api/createstem");
        if(request.ok) {
            const content = await request.json();

            addStem("Untitled", content.id);
            stems.push({"id": content.id, "json_data": ""});
        }
    }


    async function loadStem(id) {
        //get song data 
        pauseStem();
        isLoading = true;
        document.querySelector(".playingText").innerText = "Loading...";

        const localStem = findStem(id);
        const stemData = stems[localStem]["data"];   

        try {
            const jsonData = JSON.parse(stemData);
            if(jsonData.media?.query && jsonData.media?.source) {
                await getStem(jsonData.media.query, jsonData.media.source);
                document.querySelector(".playingText").innerText = jsonData.info.title;
                nowPlaying = localStem;
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: jsonData.info.title,
                    //artist: "artist",
                    //album: "album",
                    //artwork: [
                    //    { src: "/cover.png", sizes: "512x512", type: "image/png" }
                    //]
                });
                

            } else {
                document.querySelector(".playingText").innerText = "No song data";
            }


        } catch (error) {
             console.log(error);
            document.querySelector(".playingText").innerText = "JSON error";
        }
        isLoading = false;
    }

    //END REST WRAPPER FUNCTIONS

    function findStem(id) {
        for(let i = 0; i < stems.length; i++) {
            if(stems[i]["id"] == id) {
                return i;
            }
        }
        return null;
    }

    navigator.mediaSession.setActionHandler("play", () => {
        playStem();
    });

    navigator.mediaSession.setActionHandler("pause", () => {
        pauseStem();
    });

    navigator.mediaSession.setActionHandler("previoustrack", () => {
        lastStem();
    });

    navigator.mediaSession.setActionHandler("nexttrack", () => {
        nextStem();
    });

    function playStem() {
        if(!isLoading) {
            bass.play();
            drums.play();
            vocals.play();
            other.play();

            isPlaying = true;

            syncInterval = setInterval(syncStem, 100);

            document.querySelector(".control.play").innerText = "■";
        }
    }

    function pauseStem() {
        if(!isLoading) {
            bass.pause();
            drums.pause();
            vocals.pause();
            other.pause();

            isPlaying = false;

            if(syncInterval) {
                clearInterval(syncInterval);
            }

            document.querySelector(".control.play").innerText = "▶";
        }
    }

    function syncStem() {
        let syncTime = bass.currentTime;
        //bass.currentTime = syncTime;
        drums.currentTime = syncTime;
        vocals.currentTime = syncTime;
        other.currentTime = syncTime;
    }

    async function nextStem() {
        if(nowPlaying != -1 && !isLoading) {
            for(let i = nowPlaying + 1; i < stems.length; i++) { //Checking all songs from nowplaying index to the end
                console.log("iterating")
                try {
                    const parsed = JSON.parse(stems[i].data);
                    if(parsed.media?.source && parsed.media?.query) { //check if stem is valid
                        await loadStem(stems[i].id); 
                        playStem();
                        break; //exit for loop once valid stem found
                    }
                } catch (error) {
                    console.log(error);
                    //JSON parser error most likely, script will continue;
                }
                
            }
        }
    }

    async function lastStem() {
        if(nowPlaying != -1 && !isLoading) {
            for(let i = nowPlaying - 1; i >= 0; i--) { //Checking all songs from nowplaying index to the end
                try {
                    const parsed = JSON.parse(stems[i].data);
                    if(parsed.media?.source && parsed.media?.query) { //check if stem is valid
                        await loadStem(stems[i].id); 
                        playStem();
                        break; //exit for loop once valid stem found
                    }
                } catch (error) {
                    console.log(error);
                    //JSON parser error most likely, script will continue;
                }
                
            }
        }
    }

    document.querySelector(".control.play").addEventListener("click", function(e) {
        if(!bass.paused) { //using bass as a baseline to probe if all tracks are playing
            pauseStem();
        } else {
            playStem();
        }
    })

    function openEditor(id) {
        const editor = document.querySelector(".editor");
        const localStem = findStem(id);
        editor.classList.remove("hidden");

        editingID = id;
        
        console.log(stems[localStem]["data"]);

        document.querySelector(".stemJSON").value = stems[localStem]["data"];
    }

    document.querySelector(".editorButton.save").addEventListener("click", function(e){
        editStem(editingID, document.querySelector(".stemJSON").value);
    });

    document.querySelector(".editorButton.close").addEventListener("click", function(e){
        document.querySelector(".editor").classList.add("hidden")
    });

    function addStem(name, action_id){
        const templateSong = document.querySelector(".song.example");
        const clonedSong = templateSong.cloneNode(true);

        clonedSong.classList.remove("hidden", "template");
        clonedSong.setAttribute("stemID", String(action_id));
        clonedSong.querySelector(".title").innerText = name;
        clonedSong.addEventListener("click", async function(event){
            if(!event.target.closest(".songOption")){
                await loadStem(action_id); 
                playStem();
            }
        });
        clonedSong.querySelector(".editbtn").addEventListener("click", function(){openEditor(action_id);});
        clonedSong.querySelector(".deletebtn").addEventListener("click", function(){deleteStem(action_id);});

        const list = document.querySelector(".songList");
        list.appendChild(clonedSong);
    }
