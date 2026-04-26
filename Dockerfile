FROM alpine:latest

# Add panel-rs and entrypoint
ARG TARGETPLATFORM
COPY .docker/${TARGETPLATFORM#linux/}/panel-rs /usr/bin/panel-rs

RUN ln -s /usr/bin/panel-rs /usr/local/bin/calagopus-panel

ENV OCI_CONTAINER=official

ENTRYPOINT ["/usr/bin/panel-rs"]
