FROM crowdin/cli

RUN apk --no-cache add curl git jq;

COPY . .
COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]