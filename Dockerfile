FROM crowdin/cli:3.5.3

RUN apk --no-cache add curl git jq;

COPY . .
COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
