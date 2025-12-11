import subprocess

cmd = [
    "demucs",
    "-n", "mdx_extra_q",
    "-o", "songs",
    f"songs/2006469379/original2006469379.mp3"
]
proc = subprocess.run(cmd, check=True,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=5)


for line in iter(proc.stdout.readline, ''):
    if line.endswith("\n"):
        print("LINE:", line.rstrip())