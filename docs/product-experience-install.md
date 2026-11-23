# Product experience blueprint — document-only update

Read `product-experience-v1.md` for the roles, registration flows, dashboard specifications, current implementation gaps and delivery order.

No SQL, npm command, firmware upload or credential replacement is required. The current app continues to work unchanged.

The included patch only adds two documentation files and does not depend on the older optional requirements document or server-security test file. Applying it is optional; it simply keeps the design alongside your code.

If you want the documents in your web repository, save/commit local changes, check there is no unfinished Git patch operation, copy `jns-split-product-experience.patch` into the project folder and run once:

```powershell
git switch -c docs/product-experience
git am ./jns-split-product-experience.patch
```

Stop on any Git error rather than repeating the apply command. No development-server restart is needed.
