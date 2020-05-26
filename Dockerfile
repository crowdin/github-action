FROM crowdin/cli:alpine

RUN apk --no-cache add curl git jq;

COPY . .
COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
