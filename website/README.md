# KongDaily by Lenny Studio

The app and the static pages read the same bilingual Privacy and Support content from `content/compliance.json`. Lenny provides KongDaily as an individual developer under the Lenny Studio brand. The shared Privacy and Support mailbox is `lenny996@163.com`. The site uses plain HTML and CSS with no runtime scripts, tracking tags, cookies, forms or CDN dependencies.

## Local review

From the repository root, generate the review pages and serve them locally.

```sh
node website/build.cjs
python3 -m http.server 4173 --bind 127.0.0.1 --directory website/dist/review
```

Open `http://127.0.0.1:4173/`. The Traditional Chinese pages are under `/privacy/` and `/support/`. The English pages are under `/en/privacy/` and `/en/support/`. The trailing slashes resolve to directory indexes and work on a standard static host. All navigation and CSS links are relative. Review pages carry a visible draft label and a `noindex` directive.

## Before the first public deployment

```sh
node website/build.cjs --check-release
node website/build.cjs --release
```

Both commands currently fail while approval records and policy inputs are pending. After approval, enter the actual effective and update dates and the bilingual hosting, support and retention disclosures in `content/compliance.json` under `publication`. The app and the release website use those same values. The draft review date is separate. Record the policy and asset rights approvals in `website/release.json` at the same time. The operator verification reference is already recorded. The disclosures must reflect actual hosting logs, mail and attachment handling, retention and deletion. The policy approval must cover the app provider facts used by the public copy. The asset decision must cover the Dragon’s Back photograph and any affected distribution materials. [Evidence and approval checklist](../docs/REL-01C1B2-PRIVACY-AND-LICENSE-RELEASE-GATE.md)

`origin` may stay `null` until the live address has been assigned. The first approved build then uses relative links and omits canonical tags. For a Vercel project, use the repository root, the Other framework preset, Node.js 22, install command `true`, build command `node website/build.cjs --release` and output directory `website/dist/release`. Serve the four directory-index paths with their trailing slashes. Deploy only the approved release output from the checked revision. [Vercel project configuration](https://vercel.com/docs/project-configuration)

## After the public HTTPS address is assigned

Record the actual public origin without a trailing slash in `website/release.json`. From the same revision as the deployed content, with that origin set, run:

```sh
node website/build.cjs --check-live
```

This checks the four exact public HTTPS paths for an HTTP 200 HTML response and compares the response with approved output. The checker accepts the origin-free first deployment and the later version with the correct canonical tags. Confirm support mailbox delivery separately. Use the verified URLs when adding public links to the app and App Store Connect. [Vercel generated URLs](https://vercel.com/docs/deployments/generated-urls)

## Before App Store submission

Review the release candidate’s aggregated Apple Privacy Report, including the location declaration in `react-native-maps`, and reconcile it with provider data practices before completing App Privacy. The static site checks verify inputs and public routes. Candidate-level privacy decisions require separate evidence. [Apple App Privacy guidance](https://developer.apple.com/app-store/app-privacy-details/)
