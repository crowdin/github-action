FROM crowdin/cli:3.4.1

RUN apk --no-cache add curl git jq;

COPY . .
COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
