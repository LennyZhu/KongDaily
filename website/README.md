# KongDaily by Lenny Studio

The app and the static pages read the same bilingual Privacy and Support content and verified contact in `content/compliance.json`. KongDaily is offered by an individual developer under the Lenny Studio brand. The legal operator's verified name belongs in the separate release inputs. The site uses plain HTML and CSS with no runtime scripts, tracking tags, cookies, forms or CDN dependencies.

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

Both commands currently fail. The verified support and privacy mailbox is in the shared content and also works in the local review pages. To clear the release check, supply the verified legal name in both locales and its verification reference, the assigned and verified HTTPS origin, effective and update dates, approved site and support privacy text and retention disclosures in both languages, and separate references for privacy approval and required asset rights. The privacy text must reflect actual hosting logs, mail and attachment handling, retention, deletion and contacts. The approval must cover the app provider disclosures as well. For asset rights, retain a separate record of the clearance or removal decision, including the Dragon’s Back photograph and any affected distribution materials.

The approved static output directory is `website/dist/release`. Run the publication check for the exact revision before deploying that output. The builder writes no release files when required inputs fail validation. The check verifies completeness and format. The release owner confirms the evidence and tests both language versions of the live HTTPS routes and email delivery independently. See the [Vercel preflight](../docs/REL-01C1B0-WEBSITE-PUBLISH-PREFLIGHT.md) for build settings and verification order.
