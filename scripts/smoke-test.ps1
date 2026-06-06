# scripts/smoke-test.ps1
# End-to-end test: prove that one phone number can host multiple accounts on the deployed API.
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:4000/api'
$phone = '+15551112233'

function Section($name) { Write-Host ""; Write-Host "=== $name ===" -ForegroundColor Cyan }

Section '1. Health'
Invoke-RestMethod "$base/health" | ConvertTo-Json -Compress | Write-Host

Section '2. Request OTP'
$otp = Invoke-RestMethod -Method Post -Uri "$base/auth/otp/request" `
    -ContentType 'application/json' `
    -Body (@{ phone = $phone } | ConvertTo-Json)
$otp | ConvertTo-Json -Compress | Write-Host
$code = $otp.devCode
if (-not $code) { throw 'No devCode returned (is OTP_DEV_RETURN=true?)' }

Section '3. Verify OTP -> phone token'
$verify = Invoke-RestMethod -Method Post -Uri "$base/auth/otp/verify" `
    -ContentType 'application/json' `
    -Body (@{ phone = $phone; code = $code } | ConvertTo-Json)
Write-Host "phoneToken (first 20 chars): $($verify.phoneToken.Substring(0,20))..."
$h = @{ Authorization = "Bearer $($verify.phoneToken)" }

Section '4. Create FIRST identity on this phone'
$a1 = Invoke-RestMethod -Method Post -Uri "$base/accounts" -Headers $h `
    -ContentType 'application/json' `
    -Body (@{ displayName = 'Alice One'; username = "alice_$(Get-Random)" } | ConvertTo-Json)
Write-Host ("account 1: id={0}  username=@{1}" -f $a1.account.id, $a1.account.username)

Section '5. Create SECOND identity on the SAME phone'
$a2 = Invoke-RestMethod -Method Post -Uri "$base/accounts" -Headers $h `
    -ContentType 'application/json' `
    -Body (@{ displayName = 'Alice Two'; username = "alice_$(Get-Random)" } | ConvertTo-Json)
Write-Host ("account 2: id={0}  username=@{1}" -f $a2.account.id, $a2.account.username)

Section '6. List all identities for this phone'
$list = Invoke-RestMethod -Method Get -Uri "$base/accounts" -Headers $h
Write-Host "Total identities under $($phone): $($list.accounts.Count)"
$list.accounts | ForEach-Object { Write-Host (" - {0}  (@{1})  id={2}" -f $_.displayName, $_.username, $_.id) }

Section '7. Send a message between the two identities (proves each account works independently)'
# Login as account 1
$h1 = @{ Authorization = "Bearer $($a1.accountToken)" }
# Start a DM from account 1 to account 2
$conv = (Invoke-RestMethod -Method Post -Uri "$base/conversations" -Headers $h1 `
    -ContentType 'application/json' `
    -Body (@{ type = 'dm'; memberIds = @($a2.account.id) } | ConvertTo-Json)).conversation
Write-Host "Conversation: $($conv.id)"
$msg = (Invoke-RestMethod -Method Post -Uri "$base/conversations/$($conv.id)/messages" -Headers $h1 `
    -ContentType 'application/json' `
    -Body (@{ type = 'text'; text = 'Hello from Alice One to Alice Two!' } | ConvertTo-Json)).message
Write-Host ("Sent: '{0}'" -f $msg.text)

# Read from account 2 with account 2's token
$h2 = @{ Authorization = "Bearer $($a2.accountToken)" }
$inbox = Invoke-RestMethod -Method Get -Uri "$base/conversations" -Headers $h2
Write-Host "Account 2 inbox conversations: $($inbox.conversations.Count)"
$msgs = Invoke-RestMethod -Method Get -Uri "$base/conversations/$($conv.id)/messages" -Headers $h2
Write-Host ("Account 2 received: '{0}'" -f $msgs.messages[-1].text)

Write-Host ""
Write-Host "[OK] SUCCESS - one phone number, two accounts, both messaging in real time." -ForegroundColor Green

