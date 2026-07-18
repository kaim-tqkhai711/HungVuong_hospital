FROM nginx:alpine

ENV PORT=80
ENV BACKEND_URL=backend:5000

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY . /usr/share/nginx/html

EXPOSE ${PORT}
