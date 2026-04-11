# Email DNS Configuration Guide for Porkbun

## Overview
This guide helps you verify and configure SPF, DKIM, and DMARC records for `kinderbridge.ca` to improve email deliverability.

---

## Step 1: Check Current DNS Records

### Option A: Use Online Tools (Recommended)
1. Visit **MXToolbox**: https://mxtoolbox.com/spf.aspx
2. Enter your domain: `kinderbridge.ca`
3. Check these records:
   - **SPF Record**: https://mxtoolbox.com/spf.aspx?domain=kinderbridge.ca
   - **DKIM Record**: https://mxtoolbox.com/DKIM.aspx?domain=kinderbridge.ca
   - **DMARC Record**: https://mxtoolbox.com/dmarc.aspx?domain=kinderbridge.ca

### Option B: Use Command Line (if available)
```bash
# Check SPF
dig TXT kinderbridge.ca | grep spf

# Check DMARC
dig TXT _dmarc.kinderbridge.ca | grep DMARC

# Check DKIM (Porkbun uses default._domainkey)
dig TXT default._domainkey.kinderbridge.ca
```

---

## Step 2: Configure DNS Records in Porkbun

### Method 1: Use Porkbun's Automated DMARC Configuration (Easiest)

1. **Log in to Porkbun**:
   - Go to https://porkbun.com/account/login
   - Log in with your credentials

2. **Navigate to Domain Management**:
   - Click on "Domain Management" or "Account"
   - Find `kinderbridge.ca` in your domain list
   - Click the **envelope icon** (📧) under the "EMAIL" column

3. **Configure DMARC** (This automatically sets up DKIM + DMARC):
   - Scroll to "Additional Notices & Configuration" section
   - Click the **"Configure DMARC"** button
   - Wait a few minutes for configuration to complete
   - You should see a confirmation: "Your domain is configured for DMARC"

### Method 2: Manual DNS Record Configuration

If you need to add records manually:

#### A. SPF Record
1. Go to Domain Management → Click DNS icon for `kinderbridge.ca`
2. Click "Add Record"
3. Configure:
   - **Type**: TXT
   - **Host**: @ (or leave blank)
   - **Answer**: `v=spf1 include:_spf.porkbun.com ~all`
   - **TTL**: 600 (or default)
4. Click "Add"
5. **Important**: Ensure you have only ONE SPF record

#### B. DKIM Record (Usually set automatically by Porkbun)
- If not automatically configured:
  - **Type**: TXT
  - **Host**: `default._domainkey` (provided by Porkbun)
  - **Answer**: (DKIM key from Porkbun - check email settings)

#### C. DMARC Record
1. Click "Add Record"
2. Configure:
   - **Type**: TXT
   - **Host**: `_dmarc`
   - **Answer**: `v=DMARC1; p=none; rua=mailto:info@kinderbridge.ca`
     - `p=none`: Monitor mode (recommended to start)
     - `rua`: Email address to receive DMARC reports
3. Click "Add"

---

## Step 3: Recommended DMARC Policies

### Starting Phase (Monitoring):
```
v=DMARC1; p=none; rua=mailto:info@kinderbridge.ca; ruf=mailto:info@kinderbridge.ca
```
- `p=none`: Don't reject emails, just monitor
- `rua`: Aggregate reports email
- `ruf`: Forensic reports email (optional)

### After 2-4 Weeks (If all good):
```
v=DMARC1; p=quarantine; pct=10; rua=mailto:info@kinderbridge.ca
```
- `p=quarantine`: Send failed emails to spam
- `pct=10`: Apply to 10% of emails (gradual rollout)

### Final Phase (Strict):
```
v=DMARC1; p=reject; rua=mailto:info@kinderbridge.ca
```
- `p=reject`: Reject emails that fail authentication
- Only use after confirming everything works

---

## Step 4: Verify Configuration

### Verification Checklist:
- [ ] SPF record exists and includes `_spf.porkbun.com`
- [ ] DKIM record exists (check with MXToolbox)
- [ ] DMARC record exists (check with MXToolbox)
- [ ] All records are correctly formatted
- [ ] DNS propagation completed (can take up to 48 hours)

### Verification Tools:
1. **MXToolbox**: https://mxtoolbox.com/
2. **Google Admin Toolbox**: https://toolbox.googleapps.com/apps/checkmx/
3. **DMARC Analyzer**: https://www.dmarcanalyzer.com/

---

## Step 5: Test Email Authentication

After DNS records are configured:

1. **Send a test email** to: `check-auth@verifier.port25.com`
2. **Check the response** - it will show SPF, DKIM, and DMARC results
3. **Send to Gmail** and check email headers:
   - Open email in Gmail
   - Click three dots → "Show original"
   - Look for:
     - `SPF: PASS`
     - `DKIM: 'PASS'`
     - `DMARC: 'PASS'`

---

## Common Issues & Solutions

### Issue 1: Multiple SPF Records
**Problem**: Only one SPF record is allowed per domain
**Solution**: Delete duplicate SPF records, keep only one

### Issue 2: SPF Record Too Long
**Problem**: SPF records have a 255-character limit per string
**Solution**: Combine includes on one line: `v=spf1 include:_spf.porkbun.com ~all`

### Issue 3: DKIM Not Signing
**Problem**: DKIM record exists but emails aren't signed
**Solution**: 
- Verify DKIM selector matches (usually `default._domainkey`)
- Check with Porkbun support if DKIM is enabled for your account

### Issue 4: DNS Not Propagating
**Problem**: Changes not visible after 24 hours
**Solution**:
- Clear DNS cache: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)
- Wait up to 48 hours for full propagation
- Check from different DNS servers using MXToolbox

---

## Expected DNS Records Summary

For `kinderbridge.ca` using Porkbun email:

```
# SPF Record
Type: TXT
Host: @
Value: v=spf1 include:_spf.porkbun.com ~all

# DMARC Record
Type: TXT
Host: _dmarc
Value: v=DMARC1; p=none; rua=mailto:info@kinderbridge.ca

# DKIM Record (usually auto-configured)
Type: TXT
Host: default._domainkey (or provided by Porkbun)
Value: (DKIM public key from Porkbun)
```

---

## Timeline

- **Immediate**: Use Porkbun's "Configure DMARC" button
- **15-30 minutes**: DNS changes start propagating
- **24-48 hours**: Full DNS propagation
- **2-4 weeks**: Monitor DMARC reports, then increase policy strictness

---

## Support Resources

- **Porkbun Knowledge Base**: https://kb.porkbun.com/article/179-how-to-turn-on-dkim-dmarc
- **Porkbun Support**: Contact through your Porkbun account
- **MXToolbox**: https://mxtoolbox.com/ (DNS verification)

---

## Notes

- Start with `p=none` in DMARC to monitor without blocking emails
- Check DMARC reports regularly (sent to email in `rua`)
- Gradually increase DMARC policy strictness as confidence grows
- Keep DNS records simple and avoid conflicting records





