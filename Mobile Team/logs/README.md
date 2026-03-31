Dev console logs are created by the app at runtime in its writable app-documents storage under `Mobile Team/logs/`.

The running app cannot reliably write directly back into this repo folder on iOS, Android, or web, so this directory is only a documentation placeholder for that runtime path.

Use the universal in-app `Dev Mode` overlay to save a log file, then read the saved path shown in the overlay status text.
