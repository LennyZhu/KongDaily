# KongDaily by Lenny Studio

The app and the static pages read the same bilingual Privacy and Support content from `content/compliance.json`. Lenny provides KongDaily as an individual developer under the Lenny Studio brand. The shared Privacy and Support mailbox is `lenny996@163.com`. The site uses plain HTML and CSS with no runtime scripts, tracking tags, cookies, forms or CDN dependencies.

## Local review

From the repository root, generate the review pages and serve them locally.

```sh
node website/build.cjs
python3 -m http.server 4173 --bind 127.0.0.1 --directory website/dist/review
```

Open `http://127.0.0.1:4173/`. The Traditional Chinese pages are under `/privacy/` and `/support/`. The English pages are under `/en/privacy/` and `/en/support/`. Both photo credits pages, `/credits/explore/` and `/en/credits/explore/`, cite eight photographs. Seven are also available as exact app JPEGs under `/credits/explore/photos/`. The West Kowloon Art Park credit points to the original Unsplash page. The deployment build checks each asset against its individually reviewed publication mode and SHA-256 value. Review pages carry a visible draft label and a `noindex` directive. Keep review builds local or access-controlled.

## Before the first public deployment

```sh
node website/build.cjs --check-release
node website/build.cjs --release
```

1. Review the bilingual policy and the actual hosting and mail settings. The shared policy includes the approved limit of 12 months after a support case is resolved, subject to applicable legal retention obligations. Confirm who can access the mailbox and hosting logs, any forwarding or exports, and the known limits for independently retained provider records. Prepare the manual process. [Support email procedure](../docs/operations/SUPPORT-EMAIL-RETENTION.md)
2. Approve the photo publication matrix for the seven exact JPEGs and the source-only Unsplash credit. Record the two approval references under `approvalReference` and `assetRightsApprovalReference` in `website/release.json`. The photo review for App Store distribution is separate. [Gate A photo evidence](../docs/REL-01C1B4-PRODUCTION-WEBSITE-GATE-A.md)
3. Approve the first public date in Hong Kong time before deploying. Set `publication.effectiveOn` and `publication.updatedOn` to the same approved date in `content/compliance.json`. The app and website share the dates and policy version. After the first publication, keep the original effective date and change Last Updated only when the policy changes. Build from a fresh checkout of the approved revision. Both commands above must pass.
4. After approval, create a dedicated Vercel project in the confirmed scope, with the repository root as its Root Directory and Node.js 22. The project can use the suggested name `kongdaily` if available. Keep Git Integration disconnected for the first release. The project configuration also disables automatic deployments from Git. Use the Other preset, install command `true`, build command `node website/build.cjs --release`, output directory `website/dist/release` and trailing slashes. Protect staging URLs and verify the final production alias works without authentication. Keep Analytics, Speed Insights and script injection disabled. The staged build, artifact check, promotion and rollback commands are in the [Gate A runbook](../docs/REL-01C1B4-PRODUCTION-WEBSITE-GATE-A.md). [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json) · [Git deployment settings](https://vercel.com/docs/project-configuration/git-configuration) · [Deployment protection](https://vercel.com/docs/deployment-protection)

`origin` and `firstPublicDeploymentAt` may stay `null` before the first public deployment. The first approved build uses relative links and can omit canonical tags. Publish only the release output from that approved revision.

## After the public HTTPS address is assigned

Record the public HTTPS origin without a trailing slash and the actual first public timestamp (`firstPublicDeploymentAt`, ISO 8601 with a time-zone offset or UTC) in `website/release.json`. Use the time the production site became public. A protected preview’s build timestamp may precede that event. From the same content revision, run the following command.

```sh
node website/build.cjs --check-live
```

The checker compares the launch day in Hong Kong with the policy effective date. A mismatch blocks verification. If the site is already public, halt rollout, reconcile the actual date and approve any correction in both app and website before continuing. The checker also verifies the four privacy and support paths, both credits pages, both home pages, language and mail links, same-origin trailing-slash redirects, the stylesheet, seven exact JPEG hashes, a 404 for the West Kowloon Art Park JPEG and a separate missing-path 404. The origin-free first deployment and an otherwise identical version with correct canonical links are both accepted.

Use a signed-out browser to confirm the four policy and support pages work in both languages and that the photos open and download without an account, DRM or tracking scripts. Confirm mailbox delivery separately. Once verified, add the real URLs to the existing app credits and App Store Connect through their separate approval workflows. Verify again if the serving origin changes. [Vercel generated URLs](https://vercel.com/docs/deployments/generated-urls)

## Before App Store submission

Review the release candidate’s aggregated Apple Privacy Report, including the location declaration in `react-native-maps`, and reconcile it with provider data practices before completing App Privacy. Confirm that the final app and applicable store terms respect each bundled photo’s licence, including CC BY 4.0 for Victoria Peak Garden. The public download is independently available after deployment. The signed app, applicable EULA and any technical restrictions still need their own review. [Apple App Privacy guidance](https://developer.apple.com/app-store/app-privacy-details/) · [Apple standard EULA](https://www.apple.com/legal/internet-services/itunes/dev/stdeula/) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.en)
