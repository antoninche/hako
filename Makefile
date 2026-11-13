# HakoS : commandes du dépôt. « make » seul affiche l'aide.
# Les cibles appellent les scripts de scripts/. Aucune ne touche à local/ (clés et mots de passe).

RACINE := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
# Image à vérifier pour « make verifier-image IMAGE=deploy/… » (facultatif).
IMAGE ?=

.PHONY: aide images build build-dev build-prod lint verifier-image clean

aide:
	@echo "HakoS : construction de l'image système de la box HAKO."
	@echo ""
	@echo "  make images          télécharge les images Docker figées (arm64) et les enregistre dans images/"
	@echo "  make build-dev       construit l'image de l'équipe (SSH par clé), dans deploy/"
	@echo "  make build-prod      construit l'image des clients (aucun accès), dans deploy/"
	@echo "  make build           comme make build-prod"
	@echo "  make lint            contrôles qualité : shellcheck, fichiers compose, secrets"
	@echo "  make verifier-image  vérifie une image construite (IMAGE=deploy/… pour en choisir une)"
	@echo "  make clean           supprime deploy/ et images/ après confirmation (jamais local/)"

images:
	@"$(RACINE)/scripts/recuperer-images.sh"

build-dev:
	@"$(RACINE)/scripts/construire.sh" dev

build-prod:
	@"$(RACINE)/scripts/construire.sh" prod

build: build-prod

lint:
	@"$(RACINE)/scripts/verifier-qualite.sh"

verifier-image:
	@"$(RACINE)/scripts/verifier-image.sh" $(IMAGE)

clean:
	@echo "Suppression de $(RACINE)/deploy (images construites, journaux) et de $(RACINE)/images (archives Docker)."
	@echo "Le dossier local/ (clés et mots de passe) n'est jamais touché."
	@printf "Taper « oui » pour confirmer : "; \
	read reponse; \
	if [ "$$reponse" = oui ]; then \
		rm -rf "$(RACINE)/deploy" "$(RACINE)/images"; \
		echo "deploy/ et images/ supprimés."; \
	else \
		echo "Annulé : rien n'a été supprimé."; \
	fi
