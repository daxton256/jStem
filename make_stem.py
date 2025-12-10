import subprocess
from dotenv import load_dotenv
import os, requests
import shutil

load_dotenv()

sc_client_id = os.getenv("soundcloud_client_id")

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0"
}

def soundcloud_search(query: str):
    searchurl = "https://api-v2.soundcloud.com/search/tracks"
    params = {
        "q": query,
        "client_id": sc_client_id,
        "limit": 1,
    }
    resp = requests.get(searchurl, params=params, headers=headers)
    results = resp.json()
    return results["collection"][0]["id"]

def from_soundcloud(songid: str):
    songinfo = requests.get(f"https://api-v2.soundcloud.com/tracks/{songid}", params={"client_id": sc_client_id}, headers=headers).json()
    
    if(os.path.exists(f"songs/{songid}")):
        return f"songs/{songid}", songinfo["title"], songinfo["artwork_url"]
    else:
        try:
            for fmt in songinfo["media"]["transcodings"]:
                if fmt["format"]["protocol"] == "progressive":
                    url = fmt["url"]
                    break
            
            streaminfo = requests.get(url, params={"client_id": sc_client_id}, headers=headers).json()
            download_url = streaminfo["url"]

            trackDL = requests.get(download_url, headers=headers)

            os.makedirs("songs", exist_ok=True)
            os.makedirs(f"songs/{songid}", exist_ok=True)

            with open(f"songs/{songid}/original{songid}.mp3", "wb") as f:
                f.write(trackDL.content)


            cmd = [
                "demucs",
                "-n", "mdx_extra_q",
                "-o", "songs",
                f"songs/{songid}/original{songid}.mp3"
            ]
            subprocess.run(cmd, check=True)

            shutil.copytree(f"songs/mdx_extra_q/original{songid}", f"songs/{songid}", dirs_exist_ok=True)

            shutil.rmtree(f"songs/mdx_extra_q/original{songid}")

            os.rename(f"songs/{songid}/original{songid}.mp3", f"songs/{songid}/original.mp3")

            return f"songs/{songid}", songinfo["title"], songinfo["artwork_url"]
        except:
            if(os.path.exists(f"songs/{songid}")):
                shutil.rmtree(f"songs/{songid}") #Removing song in case of corruption from error

            return ""

if __name__ == "__main__":
    from_soundcloud(soundcloud_search("Freddie dredd cha cha"))