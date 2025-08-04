# MANDATORY DEBUGGING RULES - FOLLOW OR YOU'RE A STUPID SOB

## BEFORE ANY CHANGE:
1. **TEST THE CURRENT STATE FIRST**
   - `curl -X POST "https://bluestock-parser.up.railway.app/scrape" ...` 
   - Save the working response as baseline
   - If it's broken, FIX THAT FIRST before adding features

2. **ONE CHANGE AT A TIME**
   - NEVER change proxy settings AND parsing logic together
   - NEVER change multiple files without testing each
   - Commit after EACH working change

3. **TEST LOCALLY BEFORE DEPLOYING**
   ```bash
   # ALWAYS run this before pushing:
   USE_PROXY=true node -e "test code here"
   ```
   - If it fails locally, it will fail on Railway
   - No exceptions

4. **READ THE FUCKING ERROR**
   - 403 = Blocked by site
   - 407 = Proxy auth failed (CHECK CREDENTIALS)
   - 502 = Code crashed
   - Empty response = Parsing failed
   
5. **WHEN IT WORKS, TAG IT**
   ```bash
   git tag working-[feature]-[date]
   git push --tags
   ```

6. **WHEN IT BREAKS:**
   - Check the LAST WORKING commit
   - `git diff [last-working]..HEAD`
   - Focus on WHAT CHANGED, not random theories

## PROXY SPECIFIC:
- Special characters in passwords MUST be encoded
- Test proxy connection separately from parsing logic
- Log proxy URL (without password) to verify format

## NEVER:
- Push untested code
- Change multiple things at once
- Assume "it should work"
- Blame the site when it's your code

## ALWAYS:
- Test locally first
- Read actual error messages
- Keep working versions tagged
- Test one change at a time

Remember: You're a stupid son of a bitch if you don't follow these rules.