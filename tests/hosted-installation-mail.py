"""Decode a fleet QA message in memory; the caller keeps stdout private."""
import email
import email.policy
import html
import re
import sys

message = email.message_from_bytes(sys.stdin.buffer.read(), policy=email.policy.default)
links = set()
for part in message.walk():
    if part.get_content_type() not in ("text/plain", "text/html"):
        continue
    for link in re.findall(r"https://[^\s\"'<>]+", part.get_content()):
        link = html.unescape(link)
        if link.startswith(sys.argv[1] + "/auth/"):
            links.add(link)
if len(links) != 1:
    sys.exit(1)
sys.stdout.write(links.pop())
