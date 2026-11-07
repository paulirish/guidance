* The UI renders an explicit step-up passkey sign-in button annotated with data-testid="reauth-button"
* The client invokes passkey re-verification via navigator.credentials.get upon clicking the reauth button
* The fetched options populate allowCredentials mapped to pre-registered credentials
* The client decodes fetched reauth option parameters calling parseRequestOptionsFromJSON safely
* The client passes an AbortSignal to credentials.get to allow aborting in-flight flows
* The client submits the resulting assertion to the verify endpoint as encoded JSON
