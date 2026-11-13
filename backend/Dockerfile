FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY backend/EcoNotasServer.java .
RUN javac EcoNotasServer.java

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/EcoNotasServer*.class ./
RUN useradd --system --create-home --uid 10001 econotas && mkdir /data && chown econotas:econotas /data
USER econotas
ENV PORT=8080 ECONOTAS_BIND=0.0.0.0 ECONOTAS_DATA_DIR=/data
EXPOSE 8080
CMD ["java","EcoNotasServer"]
