# Security policy

## Reporting a vulnerability

Do not open a public issue for a security problem.

Report it privately to the maintainers through the repository's security
advisory feature, or by email to the address listed in the repository profile.
Include:

- the affected version or commit
- a minimal reproduction
- the impact you believe is possible
- whether a secret may have been exposed

You should receive an acknowledgment within 3 business days. Please allow time
for a fix before public disclosure.

## Scope

Kapibara is a local safety layer. The most important properties are:

- no raw secret values in tool output, logs, errors, or audit records
- no filesystem access outside the workspace
- no automatic directory crawling
- no network access, telemetry, or account requirement
- no silent failure that turns a broken check into `ALLOW`

Reports about these properties are especially valuable.

## Not a sandbox

Kapibara does not isolate code, restrict syscalls, or enforce operating-system
permissions. An agent with local code execution can bypass an in-process check.
Use real sandboxing and least-privilege credentials for untrusted workloads.

Secret detection is regex-based and can produce false negatives and false
positives. A clean scan is not proof that content is safe.

## Handling secrets

If you find a real credential in this repository, do not copy it into an issue.
Report the location privately. Maintainers should rotate the credential, remove
it from history, and add a regression test with a fake value.
