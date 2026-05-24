FROM mcr.microsoft.com/playwright:v1.44.1-jammy

WORKDIR /app

COPY package.json ./
RUN npm install

# Install Playwright Chromium browser
RUN npx playwright install chromium

COPY . .

EXPOSE 3001

CMD ["node", "server.js"]
