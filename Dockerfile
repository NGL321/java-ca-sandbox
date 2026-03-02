# Gradle managed environment
FROM gradle:8.13-jdk21-alpine AS build
COPY --chown=gradle:gradle . /home/gradle/src
WORKDIR /home/gradle/src

# Run the gradle build
RUN gradle build -x test --no-daemon

# Configure Java runtime
FROM eclipse-temurin:21-jre-alpine

# Expose port for webserver
EXPOSE 8080

# Move the built runtime jar to app directory
RUN mkdir /app
COPY --from=build /home/gradle/src/build/libs/*-all.jar /app/app.jar

# Copy static web resources so Javalin can serve them
COPY --from=build /home/gradle/src/src/res/public /res/public

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
