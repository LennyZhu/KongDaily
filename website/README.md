# KongDaily public pages

The app and the static pages read the same bilingual Privacy and Support content in `content/compliance.json`. The site uses plain HTML and CSS, with no runtime scripts, tracking tags, cookies, forms, CDN dependencies or build installation.

## Local review

From the repository root, generate the review pages and serve them locally.

```sh
node website/build.cjs
python3 -m http.server 4173 --bind 127.0.0.1 --directory website/dist/review
```

Open `http://127.0.0.1:4173/`. The Traditional Chinese pages are under `/privacy/` and `/support/`. The English pages are under `/en/privacy/` and `/en/support/`. The trailing slashes resolve to directory indexes and work on a standard static host. All navigation and CSS links are relative. Review pages carry a visible draft label and a `noindex` directive.

## Publication check

```sh
node website/build.cjs --check-release
node website/build.cjs --release
```

These commands currently fail because `website/release.json` has no approved operational details. Only complete it with the verified HTTPS origin, legal operator in both languages, tested privacy and support mailboxes, effective and update dates, approved site and support privacy text in both languages, and a reference to human review. The privacy text must reflect the actual hosting logs, mail and attachment handling, retention, deletion and contacts. The referenced approval must cover the app provider disclosures in the shared content as well.

The approved static output directory is `website/dist/release`. Run the publication check for the exact revision before deploying that output. The builder writes no release files when required inputs fail validation. The check verifies completeness and format. The release owner verifies the evidence, both public URLs, and email delivery separately. Consult the implementation report before removing the in-app review label or wiring the public URLs.
